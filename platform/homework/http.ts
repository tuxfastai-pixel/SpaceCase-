import {z,ZodError} from "zod";
import {HomeworkError,homeworkInput,type HomeworkInput} from "../../domains/homework/contracts";
import {readHomework,saveHomework} from "../../domains/homework/service";
import {AttendanceError,type AttendanceRoster} from "../../domains/attendance/contracts";
import {PlannerError} from "../../domains/planner/contracts";
import {classAuthority} from "../planner/http";
import {loadAttendanceRoster} from "../attendance/roster";
import {boundedText} from "../http/boundedText";
import {sameOrigin} from "../admin/peosProxy";
import {readServerEnvironment} from "../config/env";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {PeosSessionResolver} from "../session/peosSessionResolver";
import {getDatabasePool} from "../db/pool";
const id=z.string().uuid().transform(v=>v.toLowerCase());
const paramsSchema=z.object({schoolId:id,classId:id});
type Deps={session:(r:Request)=>Promise<{personId:string}|null>;authority:(a:string,p:string,s:string,c:string)=>Promise<string>;
 roster:(a:string,s:string,c:string)=>Promise<AttendanceRoster>;
 read:(a:string,s:string,c:string,t?:string,o?:number,r?:AttendanceRoster)=>Promise<object>;
 save:(a:string,s:string,c:string,i:HomeworkInput,r?:AttendanceRoster)=>Promise<object>};
export function homeworkHandler(deps:Deps){return async(request:Request,params:{schoolId:string;classId:string})=>{
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store"}});
 try{
  if(!["GET","POST"].includes(request.method))return reply({error:"METHOD_NOT_ALLOWED"},405);
  if(request.method==="POST"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
  const auth=resolvePeosAuthorization(request);if(!auth)return reply({error:"UNAUTHENTICATED"},401);
  const session=await deps.session(request);if(!session)return reply({error:"UNAUTHENTICATED"},401);
  const {schoolId,classId}=paramsSchema.parse(params);
  const query=z.object({task:id.optional(),offset:z.coerce.number().int().min(0).max(10000).default(0)}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  const input=request.method==="POST"?homeworkInput.parse(JSON.parse(await boundedText(request,150000))):undefined;
  const className=await deps.authority(auth,session.personId,schoolId,classId);
  const roster=query.task||input?.action==="COMPLETIONS"?await deps.roster(auth,schoolId,classId):undefined;
  const value=input?await deps.save(session.personId,schoolId,classId,input,roster):await deps.read(session.personId,schoolId,classId,query.task,query.offset,roster);
  return reply({...value,className});
 }catch(e){
  if(e instanceof HomeworkError||e instanceof PlannerError||e instanceof AttendanceError)return reply({error:e.code},e.status);
  if(e instanceof ZodError||e instanceof SyntaxError||e instanceof RangeError)return reply({error:"INVALID_INPUT"},400);
  return reply({error:"HOMEWORK_UNAVAILABLE"},503);
 }
};}
export async function homeworkRequest(request:Request,params:{schoolId:string;classId:string}){
 const env=readServerEnvironment();const base=env.PEOS_BASE_URL;
 if(!base||env.SPACECASE_WORKSPACE_MODE!=="operational")return Response.json({error:"HOMEWORK_UNAVAILABLE"},{status:503,headers:{"cache-control":"no-store"}});
 return homeworkHandler({session:r=>new PeosSessionResolver(base).resolve(r),authority:(a,p,s,c)=>classAuthority(base,a,p,s,c),roster:(a,s,c)=>loadAttendanceRoster(base,a,s,c),
 read:(a,s,c,t,o,r)=>readHomework(getDatabasePool(),a,s,c,t,o,r),save:(a,s,c,i,r)=>saveHomework(getDatabasePool(),a,s,c,i,r)})(request,params);
}
