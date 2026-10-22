import {z,ZodError} from "zod";
import {ObservationError,observationInput,observationQuery,type ObservationInput,type ObservationQuery} from "../../domains/observations/contracts";
import {readObservations,saveObservation} from "../../domains/observations/service";
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
 read:(a:string,s:string,c:string,r:AttendanceRoster,q:ObservationQuery)=>Promise<object>;
 save:(a:string,s:string,c:string,r:AttendanceRoster,i:ObservationInput)=>Promise<object>};
export function observationsHandler(deps:Deps){return async(request:Request,params:{schoolId:string;classId:string})=>{
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store"}});
 try{
  if(!["GET","POST"].includes(request.method))return reply({error:"METHOD_NOT_ALLOWED"},405);
  if(request.method==="POST"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
  const auth=resolvePeosAuthorization(request);if(!auth)return reply({error:"UNAUTHENTICATED"},401);
  const session=await deps.session(request);if(!session)return reply({error:"UNAUTHENTICATED"},401);
  const {schoolId,classId}=paramsSchema.parse(params);
  const query=observationQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  const input=request.method==="POST"?observationInput.parse(JSON.parse(await boundedText(request,50000))):undefined;
  const className=await deps.authority(auth,session.personId,schoolId,classId);
  const roster=await deps.roster(auth,schoolId,classId);
  const value=input?await deps.save(session.personId,schoolId,classId,roster,input):await deps.read(session.personId,schoolId,classId,roster,query);
  return reply({...value,className});
 }catch(e){
  if(e instanceof ObservationError||e instanceof PlannerError||e instanceof AttendanceError)return reply({error:e.code},e.status);
  if(e instanceof ZodError||e instanceof SyntaxError||e instanceof RangeError)return reply({error:"INVALID_INPUT"},400);
  return reply({error:"OBSERVATIONS_UNAVAILABLE"},503);
 }
};}
export async function observationsRequest(request:Request,params:{schoolId:string;classId:string}){
 const env=readServerEnvironment();const base=env.PEOS_BASE_URL;
 if(!base||env.SPACECASE_WORKSPACE_MODE!=="operational")return Response.json({error:"OBSERVATIONS_UNAVAILABLE"},{status:503,headers:{"cache-control":"no-store"}});
 return observationsHandler({session:r=>new PeosSessionResolver(base).resolve(r),authority:(a,p,s,c)=>classAuthority(base,a,p,s,c),roster:(a,s,c)=>loadAttendanceRoster(base,a,s,c),
 read:(a,s,c,r,q)=>readObservations(getDatabasePool(),a,s,c,r,q),save:(a,s,c,r,i)=>saveObservation(getDatabasePool(),a,s,c,r,i)})(request,params);
}
