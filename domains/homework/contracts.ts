import {z} from "zod";
import {attendanceDate} from "../attendance/contracts";
export class HomeworkError extends Error{constructor(public code:string,public status=403){super(code);}}
const text=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
export const taskFields=z.object({title:text(160),subject:text(80),instructions:text(8000),assignedDate:attendanceDate,dueDate:attendanceDate}).strict().refine(v=>v.dueDate>=v.assignedDate,{message:"The due date must be on or after the assigned date",path:["dueDate"]});
const id=z.string().uuid().transform(v=>v.toLowerCase());
const revision=z.number().int().min(1).max(2147483646);
export const completionStatus=z.enum(["PENDING","COMPLETED","INCOMPLETE","EXCUSED"]);
export const homeworkInput=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE"),taskId:id,fields:taskFields}).strict(),
 z.object({action:z.literal("EDIT"),taskId:id,revision,fields:taskFields}).strict(),
 z.object({action:z.enum(["ASSIGN","CLOSE","REOPEN"]),taskId:id,revision}).strict(),
 z.object({action:z.literal("COMPLETIONS"),taskId:id,revision,reason:z.enum(["INITIAL_RECORD","CORRECTION","FOLLOW_UP"]),entries:z.array(z.object({personId:id,status:completionStatus}).strict()).max(1000)}).strict(),
]).superRefine((v,ctx)=>{if(v.action==="COMPLETIONS"&&new Set(v.entries.map(e=>e.personId)).size!==v.entries.length)ctx.addIssue({code:"custom",path:["entries"],message:"Duplicate learner"});});
export type HomeworkInput=z.infer<typeof homeworkInput>;
export type TaskFields=z.infer<typeof taskFields>;
export type CompletionStatus=z.infer<typeof completionStatus>;
export type Task={id:string;title:string;subject:string;instructions:string;assignedDate:string;dueDate:string;state:"DRAFT"|"ASSIGNED"|"CLOSED";revision:number;completions:Record<string,CompletionStatus>;updatedAt:string};
