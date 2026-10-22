import {z,ZodError} from "zod";
import {boundedText} from "../http/boundedText";
import type {Pool} from "pg";
import {AssessmentError,uuid,assessmentInput,actionSchema} from "../../domains/assessment/contracts";
import {createAssessment,listAssessments,readAssessment,uploadPage,readPhoto,mutateAssessment,assistAssessment,type AssessmentScope} from "../../domains/assessment/service";
import {classAuthority} from "../planner/http";
import {loadAttendanceRoster} from "../attendance/roster";
import {AttendanceError} from "../../domains/attendance/contracts";
import {PlannerError} from "../../domains/planner/contracts";
import {readServerEnvironment} from "../config/env";
import {sameOrigin} from "../admin/peosProxy";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {PeosSessionResolver} from "../session/peosSessionResolver";
import {getDatabasePool} from "../db/pool";
import {normalizePhoto,photoStore,storageConfigured,type PhotoStore} from "./storage";
import {assessmentAi,aiConfigured,type AssessmentAi} from "./ai";
export type Params={schoolId:string;classId:string;assessmentId?:string;pageId?:string};
const paramsSchema=z.object({schoolId:uuid,classId:uuid,assessmentId:uuid.optional(),pageId:uuid.optional()}).strict();
export type Authority={scope:AssessmentScope;className:string;learners:Array<{personId:string;givenName:string;familyName:string;admissionNumber:string}>};
export async function assessmentAuthority(request:Request,p:Params):Promise<Authority>{
 const env=readServerEnvironment();const base=env.PEOS_BASE_URL;const authorization=resolvePeosAuthorization(request);
 if(!authorization)throw new AssessmentError("UNAUTHENTICATED",401);
 if(!base||env.SPACECASE_WORKSPACE_MODE!=="operational")throw new AssessmentError("PEOS_UNAVAILABLE",503);
 const session=await new PeosSessionResolver(base).resolve(request);if(!session)throw new AssessmentError("UNAUTHENTICATED",401);
 const className=await classAuthority(base,authorization,session.personId,p.schoolId,p.classId);
 const roster=await loadAttendanceRoster(base,authorization,p.schoolId,p.classId);
 return {scope:{actor:session.personId,school:p.schoolId,classId:p.classId,learnerIds:roster.learners.map(l=>l.personId)},className,learners:roster.learners};
}
type Deps={authority:(r:Request,p:Params)=>Promise<Authority>;pool:()=>Pool;store:()=>PhotoStore;ai:()=>AssessmentAi;storageReady:()=>boolean;aiReady:()=>boolean};
export function assessmentHandler(deps:Deps){return async(request:Request,params:Params)=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"private, no-store","referrer-policy":"no-referrer"}});
 try{
  if(!["GET","POST","PUT"].includes(request.method))return reply({error:"METHOD_NOT_ALLOWED"},405);
  if(request.method!=="GET"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
  if(!resolvePeosAuthorization(request))return reply({error:"UNAUTHENTICATED"},401);
  const p=paramsSchema.parse(params);
  const query=z.object({offset:z.coerce.number().int().min(0).max(1000000).default(0)}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  // Validate body before creating a pool or decoding images.
  let body:unknown;
  if(request.method!=="GET"&&!p.pageId){const raw=await boundedText(request,2000000);let json;try{json=JSON.parse(raw);}catch{throw new AssessmentError("INVALID_INPUT",400);}body=p.assessmentId?actionSchema.parse(json):assessmentInput.parse(json);}
  let bytes:Buffer|undefined;
  if(p.pageId&&request.method==="PUT"){
   if(!p.assessmentId)throw new AssessmentError("INVALID_INPUT",400);
   if(Number(request.headers.get("content-length"))>2097152)throw new AssessmentError("PHOTO_TOO_LARGE",400);
  }else if(p.pageId&&request.method!=="GET")return reply({error:"METHOD_NOT_ALLOWED"},405);
  const auth=await deps.authority(request,p).catch(e=>{if(e instanceof AssessmentError||e instanceof AttendanceError||e instanceof PlannerError)throw e;throw new AssessmentError("PEOS_UNAVAILABLE",503);});
  if(p.pageId&&p.assessmentId){
   if(!deps.storageReady())throw new AssessmentError("STORAGE_NOT_CONFIGURED",503);
   if(request.method==="GET"){
    const photo=await readPhoto(deps.pool(),auth.scope,p.assessmentId,p.pageId,deps.store());
    return new Response(new Uint8Array(photo),{headers:{"content-type":"image/jpeg","cache-control":"private, no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff","content-disposition":"inline; filename=assessment-page.jpg","content-security-policy":"default-src 'none'; sandbox"}});
   }
   // Read a bounded stream instead of buffering an arbitrarily large request.
   const reader=request.body?.getReader();if(!reader)throw new AssessmentError("INVALID_PHOTO",400);const chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2097152){await reader.cancel();throw new AssessmentError("PHOTO_TOO_LARGE",400);}chunks.push(value);}}finally{reader.releaseLock();}
   bytes=Buffer.concat(chunks);
   return reply(await uploadPage(deps.pool(),auth.scope,p.assessmentId,p.pageId,await normalizePhoto(bytes),deps.store()));
  }
  if(!p.assessmentId){
   if(request.method==="GET")return reply({...await listAssessments(deps.pool(),auth.scope,query.offset),className:auth.className});
   if(request.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
   return reply(await createAssessment(deps.pool(),auth.scope,assessmentInput.parse(body)),201);
  }
  if(request.method==="GET")return reply({...await readAssessment(deps.pool(),auth.scope,p.assessmentId),className:auth.className,learners:auth.learners,capabilities:{photoUploads:deps.storageReady(),assistedMarking:deps.aiReady()}});
  if(request.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
  const action=actionSchema.parse(body);
  if(action.action==="ASSIST"||action.action==="READ_WORK"){
   if(!deps.aiReady())throw new AssessmentError("AI_NOT_CONFIGURED",503);
   if(!deps.storageReady())throw new AssessmentError("STORAGE_NOT_CONFIGURED",503);
   return reply(await assistAssessment(deps.pool(),auth.scope,p.assessmentId,action,deps.store(),deps.ai(),async()=>(await deps.authority(request,p)).scope));
  }
  return reply(await mutateAssessment(deps.pool(),auth.scope,p.assessmentId,action));
 }catch(e){
  if(e instanceof AssessmentError||e instanceof AttendanceError||e instanceof PlannerError)return reply({error:e.code},e.status);
  if(e instanceof ZodError||e instanceof SyntaxError||e instanceof RangeError)return reply({error:"INVALID_INPUT"},400);
  return reply({error:"ASSESSMENT_UNAVAILABLE"},503);
 }
};}
export const assessmentRequest=assessmentHandler({authority:assessmentAuthority,pool:getDatabasePool,store:photoStore,ai:assessmentAi,storageReady:storageConfigured,aiReady:aiConfigured});
