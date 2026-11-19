import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {financeTransaction,financeAuthority,lockFinanceAccount,financeAudit,type FinanceScope,type FinanceAuthority} from '../school-finance/workspaceService';
import {SchoolFinanceError} from '../school-finance/money';
import {calendarPolicy,activityDetails,registerCommand,nextActivityState,type RegisterCommand,type ActivityStatus,type CalendarPolicy,type ActivityDetails} from './registerContracts';
export type ActivityVersion={id:string;revision:number;calendarId:string;details:ActivityDetails;status:ActivityStatus;preparedBy:string;actorPersonId:string;action:string;reason:string|null;createdAt:string};
export type CalendarVersion={id:string;year:number;version:number;policy:CalendarPolicy};
export async function readActivityRegister(pool:Pool,scope:FinanceScope,authorize:FinanceAuthority){
 await financeAuthority(scope,'finance.transactions.read',authorize);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);
  const calendars=await db.query<CalendarVersion>('SELECT id,academic_year AS year,version,policy FROM school_finance.activity_calendars WHERE account_id=$1 ORDER BY academic_year DESC,version DESC LIMIT 101',[scope.accountId]);
  const activities=await db.query<ActivityVersion>(`SELECT * FROM (SELECT DISTINCT ON(activity_id) activity_id AS id,revision,calendar_id AS "calendarId",details,status,prepared_by AS "preparedBy",actor_person_id AS "actorPersonId",action,reason,created_at::text AS "createdAt" FROM school_finance.activity_versions WHERE account_id=$1 ORDER BY activity_id,revision DESC) latest ORDER BY "createdAt" DESC,id LIMIT 101`,[scope.accountId]);
  await financeAudit(db,scope,'FINANCE_ACTIVITY_REGISTER_READ','ACCOUNT',scope.accountId);
  return {calendars:calendars.rows.slice(0,100),activities:activities.rows.slice(0,100),truncated:calendars.rows.length>100||activities.rows.length>100};
 });
}
export async function writeActivityRegister(pool:Pool,scope:FinanceScope,value:RegisterCommand,authorize:FinanceAuthority){
 const input=registerCommand.parse(value);
 if(input.schoolId!==scope.schoolId||input.accountId!==scope.accountId)throw new SchoolFinanceError('FINANCE_FORBIDDEN');
 const policyAction=['SAVE_CALENDAR','APPROVE_ACTIVITY','REJECT_ACTIVITY','PUBLISH_ACTIVITY','CANCEL_ACTIVITY'].includes(input.command);
 await financeAuthority(scope,policyAction?'finance.policy.manage':'finance.transactions.record',authorize);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);
  const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const existing=await db.query('SELECT actor_person_id,digest,result FROM school_finance.activity_requests WHERE account_id=$1 AND request_id=$2',[scope.accountId,input.requestId]);
  if(existing.rows[0]){if(existing.rows[0].actor_person_id!==scope.actorPersonId||existing.rows[0].digest!==digest)throw new SchoolFinanceError('ACTIVITY_REQUEST_CONFLICT');return existing.rows[0].result as {id:string;revision:number};}
  let result:{id:string;revision:number};
  if(input.command==='SAVE_CALENDAR'){
   const policy=calendarPolicy.parse(input.policy),year=Number(policy.start.slice(0,4));
   if(year<1900||year>2200)throw new SchoolFinanceError('ACTIVITY_DATE_INVALID');
   const current=await db.query('SELECT COALESCE(MAX(version),0) AS version FROM school_finance.activity_calendars WHERE account_id=$1 AND academic_year=$2',[scope.accountId,year]);
   if(Number(current.rows[0].version)!==input.expectedVersion)throw new SchoolFinanceError('ACTIVITY_REVISION_CHANGED');
   const id=randomUUID(),revision=input.expectedVersion+1;
   await db.query('INSERT INTO school_finance.activity_calendars(id,account_id,academic_year,version,policy,prepared_by) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[id,scope.accountId,year,revision,JSON.stringify(policy),scope.actorPersonId]);result={id,revision};
  }else{
   let row:ActivityVersion|null=null;
   if(input.command!=='CREATE_ACTIVITY'){
    const prior=await db.query<ActivityVersion>('SELECT activity_id AS id,revision,calendar_id AS "calendarId",details,status,prepared_by AS "preparedBy" FROM school_finance.activity_versions WHERE account_id=$1 AND activity_id=$2 ORDER BY revision DESC LIMIT 1',[scope.accountId,input.activityId]);
    row=prior.rows[0]??null;
    if(!row||row.revision!==input.revision)throw new SchoolFinanceError('ACTIVITY_REVISION_CHANGED');
   }
   let state:ActivityStatus='DRAFT';
   if(row)try{state=nextActivityState(row.status,input.command,row.preparedBy===scope.actorPersonId);}catch{throw new SchoolFinanceError('ACTIVITY_NOT_REVIEWABLE');}
   const details=activityDetails.parse('details' in input?input.details:row!.details);
   const calendar=await db.query<CalendarVersion>('SELECT id,academic_year AS year,version,policy FROM school_finance.activity_calendars WHERE account_id=$1 AND id=$2',[scope.accountId,details.calendarId]);
   const policy=calendar.rows[0]?.policy;
   if(!policy||details.eventDate<policy.start||details.eventDate>policy.end||details.paymentDeadline<policy.start)throw new SchoolFinanceError('ACTIVITY_DATE_INVALID');
   const id=row?.id??randomUUID(),revision=(row?.revision??0)+1;
   await db.query(`INSERT INTO school_finance.activity_versions(activity_id,revision,account_id,calendar_id,details,status,prepared_by,actor_person_id,action,reason) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)`,[id,revision,scope.accountId,details.calendarId,JSON.stringify(details),state,row?.preparedBy??scope.actorPersonId,scope.actorPersonId,input.command,'reason' in input?input.reason:null]);
   result={id,revision};
  }
  await financeAudit(db,scope,`FINANCE_${input.command}`,input.command==='SAVE_CALENDAR'?'ACTIVITY_CALENDAR':'ACTIVITY',result.id,{revision:result.revision,...('reason' in input?{reason:input.reason}:{})});
  await db.query('INSERT INTO school_finance.activity_requests(account_id,request_id,actor_person_id,digest,result) VALUES($1,$2,$3,$4,$5::jsonb)',[scope.accountId,input.requestId,scope.actorPersonId,digest,JSON.stringify(result)]);
  return result;
 });
}
