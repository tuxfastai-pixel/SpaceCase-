import {z} from 'zod';
import {financeDate,financeReviewReason} from '../school-finance/workspaceContracts';
import {minorUnits} from '../school-finance/money';
const text=(max:number)=>z.string().trim().min(1).max(max).regex(/^[^\u0000-\u001f\u007f]+$/);
const range=z.object({start:financeDate,end:financeDate}).strict().refine(v=>v.start<=v.end,'The end date must follow the start date');
export const paymentOptions=['MONTHLY','EVERY_TWO_MONTHS','TERM','HALF_YEAR','CUSTOM','FLEXI'] as const;
export const calendarPolicy=z.object({label:text(80),start:financeDate,end:financeDate,terms:z.array(range).length(4),halves:z.array(range).length(2),paymentOptions:z.array(z.enum(paymentOptions)).min(1).max(6),minimumMinor:z.string().refine(v=>{try{minorUnits(v);return true;}catch{return false;}})}).strict().superRefine((v,c)=>{
 if(v.start>v.end||v.start.slice(0,4)!==v.end.slice(0,4)||Number(v.start.slice(0,4))<1900||Number(v.end.slice(0,4))>2200)c.addIssue({code:'custom',message:'Choose a school year within one calendar year'});
 for(const [name,rows] of [['terms',v.terms],['halves',v.halves]] as const)rows.forEach((r,i)=>{if(r.start<v.start||r.end>v.end||(i>0&&r.start<=rows[i-1].end))c.addIssue({code:'custom',path:[name,i],message:'Periods must be ordered, non-overlapping and within the school year'});});
 if(new Set(v.paymentOptions).size!==v.paymentOptions.length)c.addIssue({code:'custom',message:'Payment options must be unique'});
 // Half-year definitions must cover the teaching terms without splitting a term.
 for(const term of v.terms)if(!v.halves.some(h=>term.start>=h.start&&term.end<=h.end))c.addIssue({code:'custom',message:'Each term must fit within one of the school-defined half-years'});
});
export type CalendarPolicy=z.infer<typeof calendarPolicy>;
export const activityDetails=z.object({calendarId:z.string().uuid(),title:text(160),description:text(1500),audience:text(200),eventDate:financeDate,paymentDeadline:financeDate,amountMinor:z.string().refine(v=>{try{return minorUnits(v)>0n;}catch{return false;}},'Enter a positive activity contribution'),optional:z.boolean()}).strict().refine(v=>v.paymentDeadline<=v.eventDate,'Money must be due on or before the activity');
export type ActivityDetails=z.infer<typeof activityDetails>;
const scope={schoolId:z.string().uuid().toLowerCase(),accountId:z.string().uuid()};
export const registerQuery=z.object(scope).strict();
const base={...scope,requestId:z.string().uuid()};
export const registerCommand=z.discriminatedUnion('command',[
 z.object({...base,command:z.literal('SAVE_CALENDAR'),expectedVersion:z.number().int().min(0).max(9998),policy:calendarPolicy}).strict(),
 z.object({...base,command:z.literal('CREATE_ACTIVITY'),details:activityDetails}).strict(),
 z.object({...base,command:z.literal('EDIT_ACTIVITY'),activityId:z.string().uuid(),revision:z.number().int().positive().max(2147483646),details:activityDetails}).strict(),
 z.object({...base,command:z.enum(['SUBMIT_ACTIVITY','APPROVE_ACTIVITY','REJECT_ACTIVITY','PUBLISH_ACTIVITY','CANCEL_ACTIVITY']),activityId:z.string().uuid(),revision:z.number().int().positive().max(2147483646),reason:financeReviewReason}).strict(),
]);
export type RegisterCommand=z.infer<typeof registerCommand>;
export type ActivityStatus='DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'PUBLISHED'|'CANCELLED';
export function nextActivityState(status:ActivityStatus,action:string,isPreparer:boolean):ActivityStatus{
 if(action==='EDIT_ACTIVITY'&&isPreparer&&['DRAFT','REJECTED'].includes(status))return 'DRAFT';
 if(action==='SUBMIT_ACTIVITY'&&isPreparer&&status==='DRAFT')return 'SUBMITTED';
 if(action==='APPROVE_ACTIVITY'&&!isPreparer&&status==='SUBMITTED')return 'APPROVED';
 if(action==='REJECT_ACTIVITY'&&!isPreparer&&status==='SUBMITTED')return 'REJECTED';
 if(action==='PUBLISH_ACTIVITY'&&status==='APPROVED')return 'PUBLISHED';
 if(action==='CANCEL_ACTIVITY'&&['DRAFT','REJECTED','APPROVED','PUBLISHED'].includes(status))return 'CANCELLED';
 throw Error('ACTIVITY_NOT_REVIEWABLE');
}
export const calendarVersionSchema=z.object({id:z.string().uuid(),year:z.number().int(),version:z.number().int().positive(),policy:calendarPolicy});
export const activityVersionSchema=z.object({id:z.string().uuid(),revision:z.number().int().positive().max(2147483646),calendarId:z.string().uuid(),details:activityDetails,status:z.enum(['DRAFT','SUBMITTED','APPROVED','REJECTED','PUBLISHED','CANCELLED']),preparedBy:z.string(),actorPersonId:z.string(),action:z.string(),reason:z.string().nullable(),createdAt:z.string()});
export const registerDataSchema=z.object({calendars:z.array(calendarVersionSchema).max(100),activities:z.array(activityVersionSchema).max(100),truncated:z.boolean()});
export type RegisterData=z.infer<typeof registerDataSchema>;
