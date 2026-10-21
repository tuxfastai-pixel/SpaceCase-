import {z} from "zod";
import {AttendanceError,type AttendanceRoster} from "../../domains/attendance/contracts";
const id=z.string().uuid().transform(v=>v.toLowerCase());
const pageSchema=z.object({class:z.object({id,name:z.string().min(1).max(80),academicYear:z.number().int().nullable()}),
 learners:z.array(z.object({personId:id,admissionNumber:z.string().min(1).max(40),givenName:z.string().min(1).max(80),familyName:z.string().min(1).max(80)})).max(100),nextOffset:z.number().int().nonnegative().nullable()});
export async function loadAttendanceRoster(baseUrl:string,authorization:string,schoolId:string,classId:string,fetchImpl:typeof fetch=fetch):Promise<AttendanceRoster>{
 const learners:AttendanceRoster["learners"]=[];const seen=new Set<string>();let classroom:AttendanceRoster["class"]|undefined;
 for(let offset=0;offset<1000;offset+=100){
  const r=await fetchImpl(new URL(`/v1/schools/${schoolId}/classes/${classId}/roster?offset=${offset}`,baseUrl),{headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(10_000)});
  if(r.status===401)throw new AttendanceError("UNAUTHENTICATED",401);
  if(r.status===403||r.status===404)throw new AttendanceError("CLASS_ACCESS_REQUIRED",403);
  if(!r.ok)throw new AttendanceError("PEOS_UNAVAILABLE",503);
  const parsed=pageSchema.safeParse(await r.json());if(!parsed.success)throw new AttendanceError("PEOS_UNAVAILABLE",503);const page=parsed.data;if(page.class.id!==classId)throw new AttendanceError("PEOS_UNAVAILABLE",503);classroom=page.class;
  for(const learner of page.learners){if(seen.has(learner.personId))throw new AttendanceError("ROSTER_CHANGED",409);seen.add(learner.personId);learners.push(learner);}
  if(page.nextOffset===null)return {class:classroom,learners};
  if(page.nextOffset!==offset+100||page.learners.length!==100)throw new AttendanceError("PEOS_UNAVAILABLE",503);
 }
 throw new AttendanceError("ROSTER_TOO_LARGE",409);
}
