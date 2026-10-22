import {z} from 'zod';
import {attendanceDate} from '../attendance/contracts';
export class ReportError extends Error {constructor(public code:string,public status=403){super(code);}}
export const reportQuery=z.object({learnerId:z.string().uuid().transform(v=>v.toLowerCase()),start:attendanceDate,end:attendanceDate}).strict().superRefine((v,c)=>{
 if(v.start>v.end||Date.parse(v.end)-Date.parse(v.start)>365*86400000)c.addIssue({code:'custom',message:'Choose a date range of up to 366 days.'});
});
export type ReportQuery=z.infer<typeof reportQuery>;
const count=z.number().int().nonnegative();
export const progressSchema=z.object({start:attendanceDate,end:attendanceDate,generatedOn:attendanceDate,timezone:z.string().min(1),
 learner:z.object({personId:z.string().uuid(),givenName:z.string(),familyName:z.string(),admissionNumber:z.string()}).strict(),
 attendance:z.object({savedRegisters:count,present:count,absent:count,late:count,excused:count,unmarked:count}).strict(),
 results:z.array(z.object({id:z.string().uuid(),title:z.string(),subject:z.string(),approvedOn:attendanceDate,total:z.number().nonnegative(),maximum:z.number().positive()}).strict()).max(200),truncated:z.boolean()
}).strict().superRefine((v,c)=>{const a=v.attendance;if(a.present+a.absent+a.late+a.excused+a.unmarked!==a.savedRegisters||v.results.some(r=>r.total>r.maximum))c.addIssue({code:'custom',message:'Inconsistent saved report data'});});
export type ProgressReport=z.infer<typeof progressSchema>;
