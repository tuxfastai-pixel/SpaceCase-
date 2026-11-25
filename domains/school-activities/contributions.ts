/** Draft calculations only. These helpers never verify money, authorize access,
 * create charges or mutate a ledger. Server adoption must reload authoritative
 * school activities, family relationships and verified allocations. */
import {z} from 'zod';
import {financeDate} from '../school-finance/workspaceContracts';
import {minorUnits,MAX_MINOR_UNITS,splitInstalments} from '../school-finance/money';
const cents=z.string().refine(v=>{try{minorUnits(v);return true;}catch{return false;}},'Use non-negative integer cents');
const activity=z.object({id:z.string().min(1).max(80),title:z.string().trim().min(1).max(160),deadline:financeDate,amountMinor:cents,verifiedMinor:cents}).strict().refine(v=>minorUnits(v.verifiedMinor)<=minorUnits(v.amountMinor),'Verified allocations cannot exceed the activity charge');
export const activitySelection=z.array(activity).min(1).max(100).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length,'Activity references must be unique');
export type ActivityContribution=z.infer<typeof activity>;
function checked(value:bigint){if(value<0n||value>MAX_MINOR_UNITS)throw Error('The combined amount is outside the supported range.');return value;}
export function activityBalances(input:ActivityContribution[]){
 const rows=activitySelection.parse(input).map(row=>({...row,outstandingMinor:(minorUnits(row.amountMinor)-minorUnits(row.verifiedMinor)).toString()}));
 const total=rows.reduce((n,r)=>checked(n+minorUnits(r.amountMinor)),0n);
 const verified=rows.reduce((n,r)=>checked(n+minorUnits(r.verifiedMinor)),0n);
 return {rows,totalMinor:total.toString(),verifiedMinor:verified.toString(),outstandingMinor:(total-verified).toString()};
}
export type ContributionMode='EARLIEST'|'SPREAD'|'CUSTOM';
export function distributeContribution(input:ActivityContribution[],amountMinor:string,mode:ContributionMode,custom:Record<string,string>={}){
 const balance=activityBalances(input),amount=minorUnits(amountMinor);
 if(!amount)throw Error('Enter an amount greater than zero.');
 if(!['EARLIEST','SPREAD','CUSTOM'].includes(mode))throw Error('Choose how to spread the contribution.');
 const sorted=[...balance.rows].sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.id.localeCompare(b.id));
 const allocations=new Map(sorted.map(row=>[row.id,0n]));let remaining=amount;
 for(const [id,value] of Object.entries(custom)){
  const row=sorted.find(r=>r.id===id);if(!row)throw Error('Choose an activity from this plan.');
  const selected=minorUnits(value);if(selected>minorUnits(row.outstandingMinor)||selected>remaining)throw Error('The chosen split exceeds the contribution or activity balance.');
  allocations.set(id,selected);remaining-=selected;
 }
 // An explicit split is retained. The automatic remainder goes to other activities.
 const candidates=sorted.filter(row=>!Object.hasOwn(custom,row.id)&&minorUnits(row.outstandingMinor)>0n);
 if(mode==='EARLIEST')for(const row of candidates){const allocated=remaining<minorUnits(row.outstandingMinor)?remaining:minorUnits(row.outstandingMinor);allocations.set(row.id,allocated);remaining-=allocated;}
 if(mode==='SPREAD'&&candidates.length){
  const total=candidates.reduce((n,r)=>n+minorUnits(r.outstandingMinor),0n),pool=remaining<total?remaining:total;
  const parts=candidates.map(row=>{const numerator=pool*minorUnits(row.outstandingMinor);return {row,value:numerator/total,remainder:numerator%total};});
  let pennies=pool-parts.reduce((n,p)=>n+p.value,0n);
  for(const part of [...parts].sort((a,b)=>a.remainder===b.remainder?0:a.remainder>b.remainder?-1:1)){if(!pennies)break;part.value++;pennies--;}
  for(const part of parts)allocations.set(part.row.id,part.value);remaining-=pool;
 }
 const rows=sorted.map(row=>({...row,proposedMinor:allocations.get(row.id)!.toString(),remainingMinor:(minorUnits(row.outstandingMinor)-allocations.get(row.id)!).toString()}));
 return {rows,contributionMinor:amount.toString(),assignedMinor:(amount-remaining).toString(),unassignedMinor:remaining.toString(),remainingMinor:(minorUnits(balance.outstandingMinor)-(amount-remaining)).toString()};
}
export const scheduleDates=z.array(financeDate).min(1).max(60).refine(d=>d.every((v,i)=>i===0||v>d[i-1]),'Choose unique payment dates in increasing order');
/** Dates come from the school's approved calendar. No hard-coded half-year or term assumptions. */
export function contributionSchedule(remainingMinor:string,dates:string[],customAmounts?:string[]){
 const remaining=minorUnits(remainingMinor);
 if(!remaining)return [];
 const dueDates=scheduleDates.parse(dates);
 const amounts=customAmounts?customAmounts.map(v=>minorUnits(v).toString()):splitInstalments(remainingMinor,dueDates.length);
 if(amounts.length!==dueDates.length||amounts.some(v=>minorUnits(v)===0n)||amounts.reduce((n,v)=>n+minorUnits(v),0n)!==remaining)throw Error('Instalments must be positive and add up exactly to the remaining balance.');
 return dueDates.map((dueDate,i)=>({dueDate,amountMinor:amounts[i]}));
}
export function deadlineShortfalls(rows:{deadline:string;remainingMinor:string}[],schedule:{dueDate:string;amountMinor:string}[]){
 const byDeadline=new Map<string,bigint>();
 for(const row of rows){financeDate.parse(row.deadline);byDeadline.set(row.deadline,checked((byDeadline.get(row.deadline)??0n)+minorUnits(row.remainingMinor)));}
 for(const payment of schedule){financeDate.parse(payment.dueDate);minorUnits(payment.amountMinor);}
 let required=0n;
 return [...byDeadline].sort(([a],[b])=>a.localeCompare(b)).flatMap(([deadline,amount])=>{
  required=checked(required+amount);const planned=schedule.filter(p=>p.dueDate<=deadline).reduce((n,p)=>checked(n+minorUnits(p.amountMinor)),0n);
  return required>planned?[{deadline,shortfallMinor:(required-planned).toString()}]:[];
 });
}
