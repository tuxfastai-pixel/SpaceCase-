/** Server-side agreement builder. Sources must be loaded under the account lock.
 * A plan records an intention; it never records payment or changes an invoice. */
import {z} from 'zod';
import {calendarPolicy,paymentOptions,type CalendarPolicy} from './registerContracts';
import {financeDate} from '../school-finance/workspaceContracts';
import {minorUnits,MAX_MINOR_UNITS} from '../school-finance/money';
import {contributionSchedule,deadlineShortfalls,scheduleDates} from './contributions';
const uuid=z.string().uuid().toLowerCase();
const cents=z.string().refine(v=>{try{minorUnits(v);return true;}catch{return false;}});
export const familyPlanChoice=z.object({
 requestId:uuid,calendarId:uuid,expectedRevision:z.number().int().min(0).max(9998),
 selections:z.array(z.object({chargeId:uuid,expectedOutstandingMinor:cents}).strict()).min(1).max(100),
 option:z.enum(paymentOptions),firstDueDate:financeDate.optional(),
 instalments:z.array(z.object({dueDate:financeDate,amountMinor:cents}).strict()).max(60).optional(),
 flexiDeadlineAcknowledged:z.boolean(),agreementChecked:z.literal(true),
}).strict().refine(v=>new Set(v.selections.map(r=>r.chargeId)).size===v.selections.length,'Choose each activity once');
export type FamilyPlanChoice=z.infer<typeof familyPlanChoice>;
export const familyPlanDraft=familyPlanChoice.innerType().omit({agreementChecked:true});
export const sourceCharge=z.object({chargeId:uuid,activityId:uuid,activityRevision:z.number().int().positive(),invoiceId:uuid,invoiceNumber:z.string().min(1).max(160),title:z.string().min(1).max(160),deadline:financeDate,amountMinor:cents,allocatedMinor:cents}).strict();
export type FamilyPlanCharge=z.infer<typeof sourceCharge>;
export class FamilyPlanError extends Error{}
function fail(code:string):never{throw new FamilyPlanError(code);}
function monthDate(year:number,month:number,day:number){const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();return `${year}-${String(month+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;}
export function approvedPlanDates(policy:CalendarPolicy,option:FamilyPlanChoice['option'],first:string,today:string){
 calendarPolicy.parse(policy);financeDate.parse(first);financeDate.parse(today);
 if(!policy.paymentOptions.includes(option)||first<today||first<policy.start||first>policy.end)fail('PLAN_DATES_UNAVAILABLE');
 if(option==='TERM'||option==='HALF_YEAR'){
  const dates=(option==='TERM'?policy.terms:policy.halves).map(p=>p.start).filter(d=>d>=first);
  if(!dates.length||dates[0]!==first)fail('PLAN_DATES_UNAVAILABLE');return dates;
 }
 if(option!=='MONTHLY'&&option!=='EVERY_TWO_MONTHS')fail('PLAN_DATES_UNAVAILABLE');
 const [year,month,day]=first.split('-').map(Number),dates:string[]=[];
 for(let m=month-1;m<12;m+=option==='MONTHLY'?1:2){const date=monthDate(year,m,day);if(date<=policy.end)dates.push(date);}
 return scheduleDates.parse(dates);
}
export function buildFamilyPlan(input:FamilyPlanChoice,source:{calendarId:string;policy:CalendarPolicy;charges:FamilyPlanCharge[];today:string}){
 const choice=familyPlanChoice.parse(input),policy=calendarPolicy.parse(source.policy);financeDate.parse(source.today);
 if(choice.calendarId!==source.calendarId||!policy.paymentOptions.includes(choice.option))fail('PLAN_POLICY_CHANGED');
 // Source is not browser data: every invoice/activity is independently scoped by the service.
 const candidates=source.charges.map(row=>sourceCharge.parse(row));
 if(new Set(candidates.map(r=>r.chargeId)).size!==candidates.length||new Set(candidates.map(r=>r.invoiceId)).size!==candidates.length)fail('PLAN_CHARGE_CONFLICT');
 const charges=choice.selections.map(selection=>{
  const charge=candidates.find(c=>c.chargeId===selection.chargeId);if(!charge)fail('PLAN_ACTIVITY_UNAVAILABLE');
  const total=minorUnits(charge.amountMinor),allocated=minorUnits(charge.allocatedMinor);
  if(allocated>total)fail('PLAN_BALANCE_CHANGED');const outstanding=total-allocated;
  if(!outstanding||outstanding.toString()!==selection.expectedOutstandingMinor)fail('PLAN_BALANCE_CHANGED');
  if(charge.deadline<policy.start||charge.deadline>policy.end)fail('PLAN_POLICY_CHANGED');
  return {...charge,outstandingMinor:outstanding.toString()};
 }).sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.chargeId.localeCompare(b.chargeId));
 const total=charges.reduce((n,c)=>n+minorUnits(c.outstandingMinor),0n);if(total>MAX_MINOR_UNITS)fail('PLAN_AMOUNT_OVERFLOW');
 let instalments:{dueDate:string;amountMinor:string}[]=[];
 if(choice.option==='FLEXI'){
  if(choice.firstDueDate||choice.instalments?.length||!choice.flexiDeadlineAcknowledged)fail('PLAN_FLEXI_ACKNOWLEDGEMENT_REQUIRED');
 }else if(choice.option==='CUSTOM'){
  if(choice.firstDueDate||!choice.instalments?.length)fail('PLAN_DATES_UNAVAILABLE');
  const dates=scheduleDates.parse(choice.instalments.map(p=>p.dueDate));
  if(dates.some(d=>d<source.today||d<policy.start||d>policy.end))fail('PLAN_DATES_UNAVAILABLE');
  try{instalments=contributionSchedule(total.toString(),dates,choice.instalments.map(p=>p.amountMinor));}catch{fail('PLAN_INSTALMENT_TOTAL_INVALID');}
 }else{
  if(!choice.firstDueDate||choice.instalments)fail('PLAN_DATES_UNAVAILABLE');
  // Fund the selected activities by their earliest deadline; never spread a trip into later months.
  let dates=approvedPlanDates(policy,choice.option,choice.firstDueDate,source.today).filter(d=>d<=charges[0].deadline);
  if(!dates.length)fail('PLAN_MISSES_ACTIVITY_DEADLINE');
  const minimum=minorUnits(policy.minimumMinor),slots=total/(minimum>0n?minimum:1n);
  if(!slots)fail('PLAN_BELOW_SCHOOL_MINIMUM');
  if(BigInt(dates.length)>slots)dates=dates.slice(0,Number(slots));
  try{instalments=contributionSchedule(total.toString(),dates);}catch{fail('PLAN_TOO_MANY_INSTALMENTS');}
 }
 if(instalments.some(p=>minorUnits(p.amountMinor)<minorUnits(policy.minimumMinor)))fail('PLAN_BELOW_SCHOOL_MINIMUM');
 const shortfalls=deadlineShortfalls(charges.map(c=>({deadline:c.deadline,remainingMinor:c.outstandingMinor})),instalments);
 if(shortfalls.length&&choice.option!=='FLEXI')fail('PLAN_MISSES_ACTIVITY_DEADLINE');
 return {version:'family-activity-plan-v1' as const,currency:'ZAR' as const,calendarId:source.calendarId,policy:structuredClone(policy),charges,option:choice.option,totalOutstandingMinor:total.toString(),instalments,shortfalls,flexiDeadlineAcknowledged:choice.flexiDeadlineAcknowledged};
}

export const familyPlanSnapshot=z.object({version:z.literal('family-activity-plan-v1'),currency:z.literal('ZAR'),calendarId:uuid,policy:calendarPolicy,charges:z.array(sourceCharge.extend({outstandingMinor:cents})).min(1).max(100),option:z.enum(paymentOptions),totalOutstandingMinor:cents,instalments:z.array(z.object({dueDate:financeDate,amountMinor:cents}).strict()).max(60),shortfalls:z.array(z.object({deadline:financeDate,shortfallMinor:cents}).strict()).max(100),flexiDeadlineAcknowledged:z.boolean()}).strict();
export const familyPlanRecord=z.object({id:uuid,revision:z.number().int().positive(),year:z.number().int(),acceptedAt:z.string(),snapshot:familyPlanSnapshot}).strict();
export const familyPlanDirectory=z.object({today:financeDate,calendars:z.array(z.object({calendarId:uuid,year:z.number().int(),policy:calendarPolicy,charges:z.array(sourceCharge).max(100),revision:z.number().int().min(0)}).strict()).max(100),plans:z.array(familyPlanRecord).max(100),truncated:z.boolean()}).strict();
export const familyPlanReview=z.object({snapshot:familyPlanSnapshot,reviewDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
