import {z} from 'zod';
import {ReportError,reportQuery,progressSchema,type ReportQuery} from '../../domains/reports/contracts';
import {readProgressReport} from '../../domains/reports/service';
import {AttendanceError,type AttendanceRoster} from '../../domains/attendance/contracts';
import {PlannerError} from '../../domains/planner/contracts';
import {classAuthority} from '../planner/http';
import {loadAttendanceRoster} from '../attendance/roster';
import {readServerEnvironment} from '../config/env';
import {resolvePeosAuthorization} from '../session/peosAuthorization';
import {PeosSessionResolver} from '../session/peosSessionResolver';
import {getDatabasePool} from '../db/pool';
type Deps={session:(r:Request)=>Promise<{personId:string}|null>;authority:(a:string,p:string,s:string,c:string)=>Promise<string>;roster:(a:string,s:string,c:string)=>Promise<AttendanceRoster>;read:(a:string,s:string,c:string,r:AttendanceRoster,q:ReportQuery)=>Promise<unknown>};
export function reportsHandler(deps:Deps){return async(request:Request,params:{schoolId:string;classId:string})=>{
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store'}});
 try{
  if(request.method!=='GET')return reply({error:'METHOD_NOT_ALLOWED'},405);
  const auth=resolvePeosAuthorization(request);if(!auth)return reply({error:'UNAUTHENTICATED'},401);
  const session=await deps.session(request);if(!session)return reply({error:'UNAUTHENTICATED'},401);
  const p=z.object({schoolId:z.string().uuid(),classId:z.string().uuid()}).safeParse(params);
  const search=new URL(request.url).searchParams,query=search.size?reportQuery.safeParse(Object.fromEntries(search)):null;
  if(!p.success||(query&&!query.success)||new Set(search.keys()).size!==search.size)return reply({error:'INVALID_INPUT'},400);
  const {schoolId,classId}=p.data;
  const className=await deps.authority(auth,session.personId,schoolId,classId),roster=await deps.roster(auth,schoolId,classId);
  if(roster.class.id!==classId)throw new ReportError('ROSTER_CHANGED',409);
  if(!query)return reply({className,learners:roster.learners});
  if(!query.success)return reply({error:'INVALID_INPUT'},400);
  if(!roster.learners.some(l=>l.personId===query.data.learnerId))throw new ReportError('LEARNER_ACCESS_REQUIRED');
  return reply({className,report:progressSchema.parse(await deps.read(session.personId,schoolId,classId,roster,query.data))});
 }catch(e){if(e instanceof ReportError||e instanceof PlannerError||e instanceof AttendanceError)return reply({error:e.code},e.status);return reply({error:'REPORT_UNAVAILABLE'},503);}
};}
export async function reportsRequest(request:Request,params:{schoolId:string;classId:string}){
 const env=readServerEnvironment(),base=env.PEOS_BASE_URL;
 if(!base||env.SPACECASE_WORKSPACE_MODE!=='operational')return Response.json({error:'REPORT_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store'}});
 return reportsHandler({session:r=>new PeosSessionResolver(base).resolve(r),authority:(a,p,s,c)=>classAuthority(base,a,p,s,c),roster:(a,s,c)=>loadAttendanceRoster(base,a,s,c),read:(a,s,c,r,q)=>readProgressReport(getDatabasePool(),a,s,c,r,q)})(request,params);
}
