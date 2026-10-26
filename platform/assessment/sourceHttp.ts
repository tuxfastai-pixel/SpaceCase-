import {z,ZodError} from 'zod';
import {AttendanceError} from '../../domains/attendance/contracts';
import {PlannerError} from '../../domains/planner/contracts';
import {AssessmentError,uuid} from '../../domains/assessment/contracts';
import {sourceKind,sourceFormat,SOURCE_BYTES,sourceMime} from '../../domains/assessment/sourceContracts';
import {assessmentAuthority} from './http';
import {sameOrigin} from '../admin/peosProxy';
import {resolvePeosAuthorization} from '../session/peosAuthorization';
import {getDatabasePool} from '../db/pool';
import {boundedText} from '../http/boundedText';
import {listSources,uploadSource,readSource,saveSourceText,hideSource} from '../../domains/assessment/sources';
import {validateSource,extractDocxText} from './sourceFiles';
import {sourceStore} from './sourceStore';
import {storageConfigured} from './storage';
const paramsSchema=z.object({schoolId:uuid,classId:uuid,assessmentId:uuid,sourceId:uuid.optional()}).strict();
type Params=z.input<typeof paramsSchema>;
export async function sourceRequest(request:Request,params:Params){
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
 try{
  if(!['GET','PUT','POST'].includes(request.method))return reply({error:'METHOD_NOT_ALLOWED'},405);
  if(request.method!=='GET'&&!sameOrigin(request))return reply({error:'FORBIDDEN'},403);
  if(!resolvePeosAuthorization(request))return reply({error:'UNAUTHENTICATED'},401);
  const p=paramsSchema.parse(params),q=z.object({kind:sourceKind.optional(),format:sourceFormat.optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  const authority=()=>assessmentAuthority(request,{schoolId:p.schoolId,classId:p.classId,assessmentId:p.assessmentId});
  const auth=await authority();
  if(!p.sourceId){if(request.method!=='GET')return reply({error:'METHOD_NOT_ALLOWED'},405);return reply({...await listSources(getDatabasePool(),auth.scope,p.assessmentId),uploadsAvailable:storageConfigured(),automaticTranscriptionAvailable:false});}
  if(request.method==='POST'){
   const input=JSON.parse(await boundedText(request,250000));
   if(input?.action==='HIDE'){const hide=z.object({action:z.literal('HIDE'),revision:z.number().int().positive()}).strict().parse(input);return reply(await hideSource(getDatabasePool(),auth.scope,p.assessmentId,p.sourceId,hide.revision));}
   if(input?.action==='EXTRACT_WORD'){
    if(!z.object({action:z.literal('EXTRACT_WORD')}).strict().safeParse(input).success)return reply({error:'INVALID_INPUT'},400);
    const source=await readSource(getDatabasePool(),auth.scope,p.assessmentId,p.sourceId,sourceStore());await authority();if(source.format!=='DOCX')return reply({error:'DOCX_REQUIRED'},400);
    return reply({text:extractDocxText(source.bytes),reviewed:false,warnings:['Plain text only. Check tables, equations, images, spacing and every answer against the source.']});
   }
   return reply(await saveSourceText(getDatabasePool(),auth.scope,p.assessmentId,p.sourceId,input));
  }
  if(!storageConfigured())return reply({error:'STORAGE_NOT_CONFIGURED'},503);
  if(request.method==='GET'){
   const source=await readSource(getDatabasePool(),auth.scope,p.assessmentId,p.sourceId,sourceStore());await authority();
   return new Response(new Uint8Array(source.bytes),{headers:{'content-type':sourceMime[source.format],'content-disposition':`attachment; filename="assessment-source.${source.format.toLowerCase()==='jpeg'?'jpg':source.format.toLowerCase()}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; sandbox"}});
  }
  if(!q.kind||!q.format)return reply({error:'INVALID_INPUT'},400);if(Number(request.headers.get('content-length'))>SOURCE_BYTES)return reply({error:'SOURCE_TOO_LARGE'},400);
  const reader=request.body?.getReader();if(!reader)return reply({error:'INVALID_INPUT'},400);const chunks:Uint8Array[]=[];let length=0;try{for(;;){const d=await reader.read();if(d.done)break;length+=d.value.byteLength;if(length>SOURCE_BYTES){await reader.cancel();return reply({error:'SOURCE_TOO_LARGE'},400);}chunks.push(d.value);}}finally{reader.releaseLock();}
  const file=await validateSource(Buffer.concat(chunks),q.format);
  return reply(await uploadSource(getDatabasePool(),auth.scope,p.assessmentId,p.sourceId,q.kind,q.format,file,sourceStore(),async()=>(await authority()).scope));
 }catch(e){if(e instanceof AssessmentError||e instanceof AttendanceError||e instanceof PlannerError)return reply({error:e.code},e.status);if(e instanceof ZodError||e instanceof SyntaxError||e instanceof RangeError)return reply({error:'INVALID_INPUT'},400);return reply({error:'ASSESSMENT_SOURCES_UNAVAILABLE'},503);}
}
