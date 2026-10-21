import {z,ZodError} from "zod";
import {PlannerError,planInput,weekDate,type PlanInput} from "../../domains/planner/contracts";
import {readPlan,savePlan} from "../../domains/planner/service";
import {sameOrigin} from "../admin/peosProxy";
import {readServerEnvironment} from "../config/env";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {PeosSessionResolver} from "../session/peosSessionResolver";
import {getDatabasePool} from "../db/pool";
const id=z.string().uuid().transform(v=>v.toLowerCase());
const paramsSchema=z.object({schoolId:id,classId:id});
const contextSchema=z.object({personId:id,schoolId:id,classIds:z.array(id),active:z.boolean(),classes:z.array(z.object({id,name:z.string()})).optional()});
export async function classAuthority(base:string,authorization:string,actor:string,school:string,classId:string,fetchImpl:typeof fetch=fetch){
 const r=await fetchImpl(new URL(`/v1/people/${actor}/teacher-context`,base),{headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(r.status===401)throw new PlannerError("UNAUTHENTICATED",401);
 if(r.status===403||r.status===404)throw new PlannerError("CLASS_ACCESS_REQUIRED");
 if(!r.ok)throw new PlannerError("PEOS_UNAVAILABLE",503);
 const parsed=contextSchema.safeParse(await r.json());if(!parsed.success)throw new PlannerError("PEOS_UNAVAILABLE",503);
 const c=parsed.data;if(!c.active||c.personId!==actor||c.schoolId!==school||!c.classIds.includes(classId))throw new PlannerError("CLASS_ACCESS_REQUIRED");
 return c.classes?.find(x=>x.id===classId)?.name??"Assigned class";
}
type Deps={session:(r:Request)=>Promise<{personId:string}|null>;authority:(a:string,p:string,s:string,c:string)=>Promise<string>;
 read:(a:string,s:string,c:string,w?:string)=>Promise<object>;save:(a:string,s:string,c:string,i:PlanInput)=>Promise<object>};
export function plannerHandler(deps:Deps){return async(request:Request,params:{schoolId:string;classId:string})=>{
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store"}});
 try{
  if(!["GET","PUT"].includes(request.method))return reply({error:"METHOD_NOT_ALLOWED"},405);
  if(request.method==="PUT"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
  const authorization=resolvePeosAuthorization(request);if(!authorization)return reply({error:"UNAUTHENTICATED"},401);
  const session=await deps.session(request).catch(()=>{throw new PlannerError("PEOS_UNAVAILABLE",503);});if(!session)return reply({error:"UNAUTHENTICATED"},401);
  const {schoolId,classId}=paramsSchema.parse(params);
  const query=z.object({week:weekDate.optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  let input:PlanInput|undefined;
  if(request.method==="PUT"){
   const body=await request.text();if(new TextEncoder().encode(body).length>2500000)return reply({error:"INVALID_INPUT"},400);
   input=planInput.parse(JSON.parse(body));
  }
  const className=await deps.authority(authorization,session.personId,schoolId,classId).catch(e=>{if(e instanceof PlannerError)throw e;throw new PlannerError("PEOS_UNAVAILABLE",503);});
  const value=input?await deps.save(session.personId,schoolId,classId,input):await deps.read(session.personId,schoolId,classId,query.week);
  return reply({...value,className});
 }catch(e){
  if(e instanceof PlannerError)return reply({error:e.code},e.status);
  if(e instanceof ZodError||e instanceof SyntaxError)return reply({error:"INVALID_INPUT"},400);
  return reply({error:"PLANNER_UNAVAILABLE"},503);
 }
};}
export async function plannerRequest(request:Request,params:{schoolId:string;classId:string}){
 const env=readServerEnvironment();const base=env.PEOS_BASE_URL;
 if(!base||env.SPACECASE_WORKSPACE_MODE!=="operational")return Response.json({error:"PLANNER_UNAVAILABLE"},{status:503,headers:{"cache-control":"no-store"}});
 return plannerHandler({session:r=>new PeosSessionResolver(base).resolve(r),authority:(a,p,s,c)=>classAuthority(base,a,p,s,c),
 read:(a,s,c,w)=>readPlan(getDatabasePool(),a,s,c,w),save:(a,s,c,i)=>savePlan(getDatabasePool(),a,s,c,i)})(request,params);
}
