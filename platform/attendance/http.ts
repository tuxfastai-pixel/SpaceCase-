import {z,ZodError} from "zod";
import {AttendanceError,attendanceDate,attendanceInput,type AttendanceRoster,type AttendanceInput} from "../../domains/attendance/contracts";
import {readAttendance,saveAttendance} from "../../domains/attendance/service";
import {readServerEnvironment} from "../config/env";
import {sameOrigin} from "../admin/peosProxy";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {PeosSessionResolver} from "../session/peosSessionResolver";
import {getDatabasePool} from "../db/pool";
import {loadAttendanceRoster} from "./roster";
type Dependencies={
 session:(r:Request)=>Promise<{personId:string}|null>;
 roster:(authorization:string,schoolId:string,classId:string)=>Promise<AttendanceRoster>;
 read:(actor:string,schoolId:string,classId:string,roster:AttendanceRoster,date?:string)=>Promise<unknown>;
 save:(actor:string,schoolId:string,classId:string,roster:AttendanceRoster,input:AttendanceInput)=>Promise<unknown>;
};
const paramsSchema=z.object({schoolId:z.string().uuid().transform(v=>v.toLowerCase()),classId:z.string().uuid().transform(v=>v.toLowerCase())});
export function attendanceHandler(deps:Dependencies){return async(request:Request,params:{schoolId:string;classId:string})=>{
 const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store"}});
 try{
  if(request.method!=="GET"&&request.method!=="PUT")return reply({error:"METHOD_NOT_ALLOWED"},405);
  if(request.method!=="GET"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
  const authorization=resolvePeosAuthorization(request);if(!authorization)return reply({error:"UNAUTHENTICATED"},401);
  const session=await deps.session(request);if(!session)return reply({error:"UNAUTHENTICATED"},401);
  const {schoolId,classId}=paramsSchema.parse(params);
  const query=z.object({date:attendanceDate.optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  let input:AttendanceInput|undefined;
  if(request.method==="PUT"){
   const body=await request.text();if(new TextEncoder().encode(body).length>150000)return reply({error:"INVALID_INPUT"},400);
   input=attendanceInput.parse(JSON.parse(body));
  }
  const roster=await deps.roster(authorization,schoolId,classId);
  return reply(input?await deps.save(session.personId,schoolId,classId,roster,input):await deps.read(session.personId,schoolId,classId,roster,query.date));
 }catch(error){
  if(error instanceof AttendanceError)return reply({error:error.code},error.status);
  if(error instanceof ZodError||error instanceof SyntaxError)return reply({error:"INVALID_INPUT"},400);
  return reply({error:"ATTENDANCE_UNAVAILABLE"},503);
 }
};}
export async function attendanceRequest(request:Request,params:{schoolId:string;classId:string}){
 const env=readServerEnvironment();
 const unavailable=()=>Response.json({error:"ATTENDANCE_UNAVAILABLE"},{status:503,headers:{"cache-control":"no-store"}});
 if(!env.PEOS_BASE_URL||env.SPACECASE_WORKSPACE_MODE!=="operational")return unavailable();
 const peosUrl=env.PEOS_BASE_URL;
 return attendanceHandler({
  session:r=>new PeosSessionResolver(peosUrl).resolve(r),
  roster:(authorization,schoolId,classId)=>loadAttendanceRoster(peosUrl,authorization,schoolId,classId),
  read:(actor,schoolId,classId,roster,date)=>readAttendance(getDatabasePool(),actor,schoolId,classId,roster,date),
  save:(actor,schoolId,classId,roster,input)=>saveAttendance(getDatabasePool(),actor,schoolId,classId,roster,input),
 })(request,params);
}
