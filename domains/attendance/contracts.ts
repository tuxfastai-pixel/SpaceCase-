import {z} from "zod";
export const attendanceStatus=z.enum(["UNMARKED","PRESENT","ABSENT","LATE","EXCUSED"]);
export type AttendanceStatus=z.infer<typeof attendanceStatus>;
export const attendanceDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(`${v}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v&&v>="1900-01-01"&&v<="2200-12-31";},"Choose a valid date");
export const attendanceInput=z.object({
 date:attendanceDate,revision:z.number().int().min(0).max(2147483646),
 reason:z.enum(["INITIAL_REGISTER","CORRECTION","LATE_UPDATE","ROSTER_UPDATE"]),
 entries:z.array(z.object({personId:z.string().uuid().transform(v=>v.toLowerCase()),status:attendanceStatus}).strict()).min(1).max(1000),
}).strict().superRefine((value,ctx)=>{
 if(new Set(value.entries.map(r=>r.personId)).size!==value.entries.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:["entries"],message:"Duplicate learner"});
 if(value.revision>0&&value.reason==="INITIAL_REGISTER")ctx.addIssue({code:z.ZodIssueCode.custom,path:["reason"],message:"Choose a correction reason"});
});
export type AttendanceInput=z.infer<typeof attendanceInput>;
export type AttendanceRoster={class:{id:string;name:string;academicYear:number|null};learners:Array<{personId:string;admissionNumber:string;givenName:string;familyName:string}>};
export class AttendanceError extends Error{constructor(public code:string,public status=403){super(code);}}
export function schoolDate(timezone:string,now=new Date()){
 const parts=new Intl.DateTimeFormat("en",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const part=(key:string)=>parts.find(p=>p.type===key)!.value;return `${part("year")}-${part("month")}-${part("day")}`;
}
export function assertRosterEntries(roster:AttendanceRoster,input:AttendanceInput){
 const allowed=new Set(roster.learners.map(r=>r.personId));
 if(input.entries.length!==allowed.size||input.entries.some(r=>!allowed.has(r.personId)))throw new AttendanceError("ROSTER_CHANGED",409);
}
