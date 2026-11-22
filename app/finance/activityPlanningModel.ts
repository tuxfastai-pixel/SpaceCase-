import {activityBalances,distributeContribution,contributionSchedule,deadlineShortfalls,type ContributionMode} from '../../domains/school-activities/contributions';
import {financeDate} from '../../domains/school-finance/workspaceContracts';
import {randToMinor} from './forms';
export type DraftActivity={id:string;title:string;deadline:string;amount:string;chosen:string};
export function planningActivities(events:DraftActivity[]){return events.map(row=>({id:row.id,title:row.title,deadline:row.deadline,amountMinor:randToMinor(row.amount),verifiedMinor:'0'}));}
/** Staff illustration only. Basic previews require no schedule; explicit advanced dates keep deadline validation. */
export function buildActivityPreview(events:DraftActivity[],amount:string,options:{mode:ContributionMode;scheduled:boolean;dates:{date:string;amount:string}[];variable:boolean}={mode:'EARLIEST',scheduled:false,dates:[],variable:false}){
 const rows=planningActivities(events),total=activityBalances(rows).totalMinor;
 const chosen=Object.fromEntries(events.filter(row=>row.chosen.trim()).map(row=>[row.id,randToMinor(row.chosen)]));
 const distribution=distributeContribution(rows,randToMinor(amount),options.mode,chosen);
 if(options.scheduled&&distribution.remainingMinor!=='0'){
  if(!options.dates.length)throw Error('Add a payment date, or turn off dates for the remaining balance.');
  options.dates.forEach((row,i)=>{if(!row.date)throw Error(`Complete payment date ${i+1}: enter the year, month and day.`);if(!financeDate.safeParse(row.date).success)throw Error(`Check payment date ${i+1}. Enter a real calendar date.`);if(i>0&&row.date<=options.dates[i-1].date)throw Error('Payment dates must run from earliest to latest, with no duplicates.');});
 }
 const schedule=options.scheduled?contributionSchedule(distribution.remainingMinor,options.dates.map(d=>d.date),options.variable?options.dates.map(d=>randToMinor(d.amount)):undefined):[];
 return {distribution,schedule,shortfalls:options.scheduled?deadlineShortfalls(distribution.rows,schedule):[],total,scheduled:options.scheduled};
}
