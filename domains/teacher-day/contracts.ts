import {z} from "zod";
import {attendanceDate} from "../attendance/contracts";
export class TeacherDayError extends Error{constructor(public code:string,public status=403){super(code);}}
const count=z.number().int().nonnegative();
export const teacherDaySchema=z.object({
 date:attendanceDate,timezone:z.string().min(1),className:z.string().min(1),
 attendance:z.object({saved:z.boolean(),rosterCount:count,marked:count,unmarked:count,present:count,absent:count,late:count,excused:count}).strict(),
 lessons:z.object({total:count,items:z.array(z.object({id:z.string().uuid(),subject:z.string(),topic:z.string(),status:z.enum(["DRAFT","READY","TAUGHT"])}).strict()).max(10)}).strict(),
 homework:z.object({overdue:count,dueToday:count,upcoming:count,items:z.array(z.object({id:z.string().uuid(),title:z.string(),subject:z.string(),dueDate:attendanceDate}).strict()).max(5)}).strict(),
 assessments:z.object({awaitingReview:count,unmatchedPhotos:count}).strict(),
 followUps:z.object({overdue:count,dueToday:count}).strict(),
}).strict().superRefine((value,ctx)=>{
 const a=value.attendance;
 if(a.marked+a.unmarked!==a.rosterCount||a.marked!==a.present+a.absent+a.late+a.excused)ctx.addIssue({code:"custom",path:["attendance"],message:"Inconsistent attendance projection"});
 if(value.lessons.items.length>value.lessons.total)ctx.addIssue({code:"custom",path:["lessons"],message:"Inconsistent lesson projection"});
});
export type TeacherDay=z.infer<typeof teacherDaySchema>;
