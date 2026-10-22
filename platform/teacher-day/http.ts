import {z,ZodError} from "zod";
import {TeacherDayError,teacherDaySchema,type TeacherDay} from "../../domains/teacher-day/contracts";
import {readTeacherDay} from "../../domains/teacher-day/service";
import {AttendanceError,type AttendanceRoster} from "../../domains/attendance/contracts";
import {PlannerError} from "../../domains/planner/contracts";
import {classAuthority} from "../planner/http";
import {loadAttendanceRoster} from "../attendance/roster";
import {readServerEnvironment} from "../config/env";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {PeosSessionResolver} from "../session/peosSessionResolver";
import {getDatabasePool} from "../db/pool";
const id=z.string().uuid().transform(v=>v.toLowerCase());
const paramsSchema=z.object({schoolId:id,classId:id});
type Deps={session:(r:Request)=>Promise<{personId:string}|null>;authority:(a:string,p:string,s:string,c:string)=>Promise<string>;
 roster:(a:string,s:string,c:string)=>Promise<AttendanceRoster>;
 read:(a:string,s:string,c:string,r:AttendanceRoster)=>Promise<Omit<TeacherDay,"className">>};
export function teacherDayHandler(deps:Deps){return async(request:Request,params:{schoolId:string;classId:string})=>{
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store"}});
 try{
  if(request.method!=="GET")return reply({error:"METHOD_NOT_ALLOWED"},405);
  const auth=resolvePeosAuthorization(request);if(!auth)return reply({error:"UNAUTHENTICATED"},401);
  const session=await deps.session(request);if(!session)return reply({error:"UNAUTHENTICATED"},401);
  const parsed=paramsSchema.safeParse(params);
  if(!parsed.success||!z.object({}).strict().safeParse(Object.fromEntries(new URL(request.url).searchParams)).success)return reply({error:"INVALID_INPUT"},400);
  const {schoolId,classId}=parsed.data;
  const className=await deps.authority(auth,session.personId,schoolId,classId);
  const roster=await deps.roster(auth,schoolId,classId);
  const value=await deps.read(session.personId,schoolId,classId,roster);
  // Validate outgoing projections too: raw learner records and note content never belong here.
  return reply(teacherDaySchema.parse({...value,className}));
 }catch(e){
  if(e instanceof TeacherDayError||e instanceof PlannerError||e instanceof AttendanceError)return reply({error:e.code},e.status);
  if(e instanceof ZodError)return reply({error:"TEACHER_DAY_UNAVAILABLE"},503);
  return reply({error:"TEACHER_DAY_UNAVAILABLE"},503);
 }
};}
export async function teacherDayRequest(request:Request,params:{schoolId:string;classId:string}){
 const env=readServerEnvironment();const base=env.PEOS_BASE_URL;
 if(!base||env.SPACECASE_WORKSPACE_MODE!=="operational")return Response.json({error:"TEACHER_DAY_UNAVAILABLE"},{status:503,headers:{"cache-control":"no-store"}});
 return teacherDayHandler({session:r=>new PeosSessionResolver(base).resolve(r),authority:(a,p,s,c)=>classAuthority(base,a,p,s,c),roster:(a,s,c)=>loadAttendanceRoster(base,a,s,c),read:(a,s,c,r)=>readTeacherDay(getDatabasePool(),a,s,c,r)})(request,params);
}
