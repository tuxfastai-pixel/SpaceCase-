import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {financeTransaction,financeAuthority,lockFinanceAccount,financeAudit,type FinanceScope,type FinanceAuthority} from '../school-finance/workspaceService';
import {FamilyBillingError,type FamilyBillingDecision} from '../../platform/family/billingAuthority';
import {familyPlanChoice,buildFamilyPlan,FamilyPlanError,type FamilyPlanCharge,type FamilyPlanChoice} from './familyPlan';
import type {CalendarPolicy} from './registerContracts';
import {z} from 'zod';
import {familyBillingDecision} from '../../platform/family/billingContracts';
const linkInput=z.object({activityId:z.string().uuid(),revision:z.number().int().positive(),invoiceId:z.string().uuid(),eligibilityChecked:z.literal(true)}).strict();
/** Staff links an already-issued learner invoice; never issues a duplicate charge. */
export async function linkActivityCharge(pool:Pool,scope:FinanceScope,value:z.infer<typeof linkInput>,authorize:FinanceAuthority){
 const input=linkInput.parse(value);await financeAuthority(scope,'finance.transactions.record',authorize);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);
  const activity=(await db.query("SELECT revision,status,details FROM school_finance.activity_versions WHERE account_id=$1 AND activity_id=$2 ORDER BY revision DESC LIMIT 1",[scope.accountId,input.activityId])).rows[0];
  if(!activity||activity.revision!==input.revision||activity.status!=='PUBLISHED')throw new FamilyPlanError('PLAN_ACTIVITY_UNAVAILABLE');
  const invoice=(await db.query("SELECT peos_learner_id,amount_minor::text,due_date::text FROM school_finance.invoices WHERE account_id=$1 AND id=$2 AND status='ISSUED' FOR UPDATE",[scope.accountId,input.invoiceId])).rows[0];
  if(!invoice||invoice.amount_minor!==activity.details.amountMinor||invoice.due_date!==activity.details.paymentDeadline)throw new FamilyPlanError('PLAN_INVOICE_MISMATCH');
  const prior=(await db.query('SELECT id,activity_id,activity_revision,invoice_id,learner_person_id FROM school_finance.activity_charge_links WHERE account_id=$1 AND (invoice_id=$2 OR (activity_id=$3 AND learner_person_id=$4))',[scope.accountId,input.invoiceId,input.activityId,invoice.peos_learner_id])).rows;
  if(prior.length){const same=prior.length===1&&prior[0].activity_id===input.activityId&&prior[0].activity_revision===input.revision&&prior[0].invoice_id===input.invoiceId&&prior[0].learner_person_id===invoice.peos_learner_id;if(!same)throw new FamilyPlanError('PLAN_CHARGE_CONFLICT');await financeAuthority(scope,'finance.transactions.record',authorize);return {id:prior[0].id as string};}
  await financeAuthority(scope,'finance.transactions.record',authorize);
  const id=randomUUID();await db.query('INSERT INTO school_finance.activity_charge_links(id,account_id,activity_id,activity_revision,invoice_id,learner_person_id,linked_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,scope.accountId,input.activityId,input.revision,input.invoiceId,invoice.peos_learner_id,scope.actorPersonId]);
  await financeAudit(db,scope,'FINANCE_ACTIVITY_CHARGE_LINKED','ACTIVITY_CHARGE',id);return {id};
 });
}
type Authorize=(grantId:string)=>Promise<FamilyBillingDecision>;
function checkScope(scope:FamilyBillingDecision,grantId:string,again?:FamilyBillingDecision){
 if(!familyBillingDecision.safeParse(scope).success||scope.grantId!==grantId||scope.action!=='family.finance.plan.accept'||Date.parse(scope.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(scope.expiresAt)))throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');
 if(again){checkScope(again,grantId);for(const key of ['personId','schoolId','learnerPersonId','action','contractVersion'] as const)if(again[key]!==scope[key])throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');}
}
async function planSources(db:PoolClient,accountId:string,learner:string,calendarId:string){
 const calendar=(await db.query<{policy:CalendarPolicy;year:number}>('SELECT policy,academic_year AS year FROM school_finance.activity_calendars WHERE account_id=$1 AND id=$2',[accountId,calendarId])).rows[0];if(!calendar)throw new FamilyPlanError('PLAN_POLICY_CHANGED');
 const charges=await db.query<FamilyPlanCharge>(`SELECT l.id AS "chargeId",l.activity_id AS "activityId",l.activity_revision AS "activityRevision",i.id AS "invoiceId",i.invoice_number AS "invoiceNumber",v.details->>'title' AS title,i.due_date::text AS deadline,i.amount_minor::text AS "amountMinor",COALESCE((SELECT SUM(a.amount_minor) FROM school_finance.allocations a WHERE a.account_id=i.account_id AND a.invoice_id=i.id),0)::text AS "allocatedMinor" FROM school_finance.activity_charge_links l JOIN school_finance.invoices i ON i.account_id=l.account_id AND i.id=l.invoice_id JOIN school_finance.activity_versions v ON v.activity_id=l.activity_id AND v.revision=l.activity_revision AND v.account_id=l.account_id WHERE l.account_id=$1 AND l.learner_person_id=$2 AND i.peos_learner_id=$2 AND v.calendar_id=$3 AND i.status='ISSUED' AND v.status='PUBLISHED' AND i.amount_minor::text=v.details->>'amountMinor' AND i.due_date::text=v.details->>'paymentDeadline' AND NOT EXISTS(SELECT 1 FROM school_finance.activity_versions newer WHERE newer.activity_id=v.activity_id AND newer.revision>v.revision) ORDER BY l.id LIMIT 101`,[accountId,learner,calendarId]);
 if(charges.rows.length>100)throw new FamilyPlanError('PLAN_TOO_MANY_ACTIVITIES');
 return {calendarId,year:calendar.year,policy:calendar.policy,charges:charges.rows};
}
/** Not exposed through HTTP until the reviewed selection/charge workflow is ready. */
export async function acceptFamilyActivityPlan(pool:Pool,grantId:string,value:FamilyPlanChoice,authorize:Authorize){
 const input=familyPlanChoice.parse(value);z.string().uuid().parse(grantId);
 const scope=await authorize(grantId);checkScope(scope,grantId);
 return financeTransaction(pool,async db=>{
  const account=(await db.query("SELECT id FROM school_finance.accounts WHERE peos_school_id=$1 AND status='ACTIVE' FOR UPDATE",[scope.schoolId])).rows[0];if(!account)throw new FamilyPlanError('PLAN_ACCOUNT_UNAVAILABLE');
  const staffScope={accountId:account.id as string,schoolId:scope.schoolId,actorPersonId:scope.personId};
  const digest=createHash('sha256').update(JSON.stringify({personId:scope.personId,grantId,input})).digest('hex');
  const prior=(await db.query('SELECT id,revision,digest,actor_person_id,learner_person_id FROM school_finance.family_activity_plans WHERE account_id=$1 AND request_id=$2',[account.id,input.requestId])).rows[0];
  if(prior){if(prior.digest!==digest||prior.actor_person_id!==scope.personId||prior.learner_person_id!==scope.learnerPersonId)throw new FamilyPlanError('PLAN_REQUEST_CONFLICT');checkScope(scope,grantId,await authorize(grantId));return {id:prior.id as string,revision:prior.revision as number};}
  const source=await planSources(db,account.id,scope.learnerPersonId,input.calendarId);
  const revision=Number((await db.query('SELECT COALESCE(MAX(revision),0) AS revision FROM school_finance.family_activity_plans WHERE account_id=$1 AND learner_person_id=$2 AND academic_year=$3',[account.id,scope.learnerPersonId,source.year])).rows[0].revision);
  if(revision!==input.expectedRevision)throw new FamilyPlanError('PLAN_REVISION_CHANGED');
  // South African school day, not a browser-provided clock or a UTC date boundary.
  const today=(await db.query("SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date::text AS today")).rows[0].today as string;
  const snapshot=buildFamilyPlan(input,{...source,today});
  checkScope(scope,grantId,await authorize(grantId));
  const id=randomUUID();await db.query('INSERT INTO school_finance.family_activity_plans(id,account_id,learner_person_id,calendar_id,revision,actor_person_id,grant_id,request_id,digest,snapshot,academic_year) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)',[id,account.id,scope.learnerPersonId,input.calendarId,revision+1,scope.personId,grantId,input.requestId,digest,JSON.stringify(snapshot),source.year]);
  await financeAudit(db,staffScope,'FINANCE_FAMILY_ACTIVITY_PLAN_ACCEPTED','FAMILY_ACTIVITY_PLAN',id,{revision:revision+1});return {id,revision:revision+1};
 });
}
