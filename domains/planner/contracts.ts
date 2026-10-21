import {z} from "zod";
import {attendanceDate,schoolDate} from "../attendance/contracts";
export class PlannerError extends Error {constructor(public code:string,public status=403){super(code);}}
export function addDays(date:string,days:number){return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);}
export function monday(date:string){const day=new Date(`${date}T00:00:00Z`).getUTCDay();return addDays(date,-((day+6)%7));}
export function currentWeek(timezone:string){return monday(schoolDate(timezone));}
export const weekDate=attendanceDate.refine(v=>monday(v)===v&&addDays(v,6)<="2200-12-31","Choose a supported Monday for this week");
const text=(max:number,min=0)=>z.string().trim().min(min).max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),"Remove unsupported characters");
export const lessonSchema=z.object({
 id:z.string().uuid(),date:attendanceDate,subject:text(80,1),topic:text(160,1),
 objectives:text(2000),activities:text(4000),resources:text(2000),reflection:text(2000),
 status:z.enum(["DRAFT","READY","TAUGHT"]),
}).strict();
export type Lesson=z.infer<typeof lessonSchema>;
export const planInput=z.object({week:weekDate,revision:z.number().int().min(0).max(2147483646),lessons:z.array(lessonSchema).max(50)}).strict().superRefine((v,ctx)=>{
 if(new Set(v.lessons.map(l=>l.id)).size!==v.lessons.length)ctx.addIssue({code:"custom",path:["lessons"],message:"Each lesson must have a unique reference"});
 v.lessons.forEach((l,i)=>{
  if(l.date<v.week||l.date>addDays(v.week,6))ctx.addIssue({code:"custom",path:["lessons",i,"date"],message:"Choose a date within this week"});
  if(l.status!=="DRAFT"&&(!l.objectives||!l.activities))ctx.addIssue({code:"custom",path:["lessons",i],message:"Ready and taught lessons need objectives and activities"});
 });
});
export type PlanInput=z.infer<typeof planInput>;
