import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {financeTransaction,financeAuthority,lockFinanceAccount,financeAudit,type FinanceScope,type FinanceAuthority} from '../school-finance/workspaceService';
import {FamilyBillingError,type FamilyBillingDecision} from '../../platform/family/billingAuthority';
import {familyBillingDecision} from '../../platform/family/billingContracts';
import {activityDetails,type ActivityDetails} from './registerContracts';
export class ParticipationError extends Error {}
export const activityOfferInput=z.object({activityId:z.string().uuid(),revision:z.number().int().positive(),learnerReference:z.string().trim().min(1).max(40),eligibilityChecked:z.literal(true)}).strict();
export const participationInput=z.object({offerId:z.string().uuid(),revision:z.number().int().positive(),choice:z.enum(['ACCEPT','DECLINE']),agreementChecked:z.literal(true)}).strict();
type Authorize=(id:string)=>Promise<FamilyBillingDecision>;
function check(d:FamilyBillingDecision,id:string,action:FamilyBillingDecision['action'],prior?:FamilyBillingDecision){
 if(!familyBillingDecision.safeParse(d).success||d.grantId!==id||d.action!==action||Date.parse(d.expiresAt)<=Date.now())throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');
 if(prior&&(['personId','schoolId','learnerPersonId','grantId','action','contractVersion'] as const).some(k=>prior[k]!==d[k]))throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');
}
async function published(db:PoolClient,account:string,id:string,revision:number){
 const row=(await db.query('SELECT revision,status,details FROM school_finance.activity_versions WHERE account_id=$1 AND activity_id=$2 ORDER BY revision DESC LIMIT 1',[account,id])).rows[0];
 if(!row||row.status!=='PUBLISHED'||row.revision!==revision)throw new ParticipationError('ACTIVITY_OFFER_CHANGED');
 const details=activityDetails.parse(row.details);const today=(await db.query("SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date::text AS today")).rows[0].today;
 if(!details.optional||details.paymentDeadline<today)throw new ParticipationError('ACTIVITY_OFFER_UNAVAILABLE');return details;
}
/** Finance explicitly authorises one eligible learner; audience text never confers access. */
export async function offerActivity(pool:Pool,scope:FinanceScope,value:z.infer<typeof activityOfferInput>,authorize:FinanceAuthority,resolveLearner:(reference:string)=>Promise<string>){
 const input=activityOfferInput.parse(value);await financeAuthority(scope,'finance.transactions.record',authorize);
 const learner=await resolveLearner(input.learnerReference);z.string().uuid().parse(learner);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);await published(db,scope.accountId,input.activityId,input.revision);
  if((await db.query('SELECT id FROM school_finance.activity_charge_links WHERE account_id=$1 AND activity_id=$2 AND learner_person_id=$3',[scope.accountId,input.activityId,learner])).rowCount)throw new ParticipationError('ACTIVITY_ALREADY_CHARGED');
  const prior=(await db.query('SELECT id,activity_revision FROM school_finance.activity_offers WHERE account_id=$1 AND activity_id=$2 AND learner_person_id=$3',[scope.accountId,input.activityId,learner])).rows[0];
  if(prior&&prior.activity_revision!==input.revision)throw new ParticipationError('ACTIVITY_OFFER_CHANGED');
  if(await resolveLearner(input.learnerReference)!==learner)throw new ParticipationError('ACTIVITY_LEARNER_CHANGED');
  await financeAuthority(scope,'finance.transactions.record',authorize);
  if(prior)return {id:prior.id as string};
  const id=randomUUID();await db.query('INSERT INTO school_finance.activity_offers(id,account_id,activity_id,activity_revision,learner_person_id,offered_by) VALUES($1,$2,$3,$4,$5,$6)',[id,scope.accountId,input.activityId,input.revision,learner,scope.actorPersonId]);
  await financeAudit(db,scope,'FINANCE_ACTIVITY_OFFERED','ACTIVITY_OFFER',id);return {id};
 });
}
/** Read includes persistent outcomes so a lost response can be checked before retry. */
export async function readActivityOffers(pool:Pool,grantId:string,authorize:Authorize){
 z.string().uuid().parse(grantId);const d=await authorize(grantId);check(d,grantId,'family.finance.read');
 return financeTransaction(pool,async db=>{
  const account=(await db.query("SELECT id FROM school_finance.accounts WHERE peos_school_id=$1 AND status='ACTIVE' FOR UPDATE",[d.schoolId])).rows[0];if(!account)throw new ParticipationError('ACTIVITY_ACCOUNT_UNAVAILABLE');
  const rows=(await db.query(`SELECT o.id,o.activity_revision AS revision,v.details,p.choice,p.invoice_id AS "invoiceId",i.invoice_number AS "invoiceNumber",(v.status='PUBLISHED' AND v.details->>'paymentDeadline'>=(now() AT TIME ZONE 'Africa/Johannesburg')::date::text AND NOT EXISTS(SELECT 1 FROM school_finance.activity_versions n WHERE n.activity_id=v.activity_id AND n.revision>v.revision)) AS available FROM school_finance.activity_offers o JOIN school_finance.activity_versions v ON v.account_id=o.account_id AND v.activity_id=o.activity_id AND v.revision=o.activity_revision LEFT JOIN school_finance.activity_participations p ON p.account_id=o.account_id AND p.offer_id=o.id LEFT JOIN school_finance.invoices i ON i.account_id=p.account_id AND i.id=p.invoice_id WHERE o.account_id=$1 AND o.learner_person_id=$2 ORDER BY o.created_at DESC,o.id LIMIT 101`,[account.id,d.learnerPersonId])).rows;
  check(await authorize(grantId),grantId,'family.finance.read',d);await financeAudit(db,{accountId:account.id,schoolId:d.schoolId,actorPersonId:d.personId},'FINANCE_ACTIVITY_OFFERS_READ','LEARNER',d.learnerPersonId);
  return {offers:rows.slice(0,100),truncated:rows.length>100};
 });
}
/** School's offer + explicit current parent charge permission; never impersonates Finance. */
export async function decideParticipation(pool:Pool,grantId:string,value:z.infer<typeof participationInput>,authorize:Authorize){
 z.string().uuid().parse(grantId);const input=participationInput.parse(value),d=await authorize(grantId);check(d,grantId,'family.finance.activity.accept');
 return financeTransaction(pool,async db=>{
  const account=(await db.query("SELECT id FROM school_finance.accounts WHERE peos_school_id=$1 AND status='ACTIVE' FOR UPDATE",[d.schoolId])).rows[0];if(!account)throw new ParticipationError('ACTIVITY_ACCOUNT_UNAVAILABLE');
  const scope={accountId:account.id as string,schoolId:d.schoolId,actorPersonId:d.personId};
  const offer=(await db.query('SELECT activity_id,activity_revision,offered_by FROM school_finance.activity_offers WHERE account_id=$1 AND id=$2 AND learner_person_id=$3',[account.id,input.offerId,d.learnerPersonId])).rows[0];
  if(!offer)throw new ParticipationError('ACTIVITY_OFFER_UNAVAILABLE');
  if(offer.activity_revision!==input.revision)throw new ParticipationError('ACTIVITY_OFFER_CHANGED');
  const prior=(await db.query('SELECT id,choice,invoice_id AS "invoiceId" FROM school_finance.activity_participations WHERE account_id=$1 AND offer_id=$2',[account.id,input.offerId])).rows[0];
  if(prior){check(await authorize(grantId),grantId,'family.finance.activity.accept',d);if(prior.choice!==input.choice)throw new ParticipationError('ACTIVITY_DECISION_ALREADY_SAVED');return prior;}
  const details:ActivityDetails=await published(db,account.id,offer.activity_id,offer.activity_revision);
  if((await db.query('SELECT id FROM school_finance.activity_charge_links WHERE account_id=$1 AND activity_id=$2 AND learner_person_id=$3',[account.id,offer.activity_id,d.learnerPersonId])).rowCount)throw new ParticipationError('ACTIVITY_ALREADY_CHARGED');
  check(await authorize(grantId),grantId,'family.finance.activity.accept',d);
  const id=randomUUID(),invoiceId=input.choice==='ACCEPT'?randomUUID():null;
  if(invoiceId){
   await db.query("INSERT INTO school_finance.invoices(id,account_id,peos_learner_id,invoice_number,amount_minor,due_date,created_by_peos_person_id,category,description) VALUES($1,$2,$3,$4,$5,$6,$7,'OTHER',$8)",[invoiceId,account.id,d.learnerPersonId,`ACT-${input.offerId}`,details.amountMinor,details.paymentDeadline,d.personId,details.title]);
   await db.query('INSERT INTO school_finance.invoice_lines(account_id,invoice_id,description,quantity,unit_price_minor) VALUES($1,$2,$3,1,$4)',[account.id,invoiceId,details.title,details.amountMinor]);
   await db.query('INSERT INTO school_finance.instalments(account_id,invoice_id,sequence,due_date,amount_minor) VALUES($1,$2,1,$3,$4)',[account.id,invoiceId,details.paymentDeadline,details.amountMinor]);
   await db.query('INSERT INTO school_finance.activity_charge_links(id,account_id,activity_id,activity_revision,invoice_id,learner_person_id,linked_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),account.id,offer.activity_id,offer.activity_revision,invoiceId,d.learnerPersonId,offer.offered_by]);
   await financeAudit(db,scope,'FINANCE_INVOICE_ISSUED','INVOICE',invoiceId,{source:'OPTIONAL_ACTIVITY_ACCEPTANCE',offerId:input.offerId,amountMinor:details.amountMinor});
  }
  await db.query('INSERT INTO school_finance.activity_participations(id,account_id,offer_id,actor_person_id,grant_id,choice,invoice_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,account.id,input.offerId,d.personId,grantId,input.choice,invoiceId]);
  await financeAudit(db,scope,'FINANCE_ACTIVITY_PARTICIPATION_DECIDED','ACTIVITY_OFFER',input.offerId,{choice:input.choice});return {id,choice:input.choice,invoiceId};
 });
}

/** One reviewed selection, one transaction. Existing offers/charges are retained and skipped. */
export async function offerActivityBatch(pool:Pool,scope:FinanceScope,value:unknown,authorize:FinanceAuthority,resolve:(refs:string[])=>Promise<{personId:string;admissionNumber:string}[]>){
 const {batchOfferInput}=await import('./offerContracts');const input=batchOfferInput.parse(value);
 await financeAuthority(scope,'finance.transactions.record',authorize);
 const checked=await resolve(input.references);
 function identities(rows:typeof checked){if(rows.length!==input.references.length||new Set(rows.map(r=>r.personId)).size!==rows.length||new Set(rows.map(r=>r.admissionNumber)).size!==rows.length||rows.some(r=>!input.references.includes(r.admissionNumber)||!z.string().uuid().safeParse(r.personId).success))throw new ParticipationError('ACTIVITY_LEARNER_CHANGED');return new Map(rows.map(r=>[r.admissionNumber,r.personId]));}
 const before=identities(checked);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);await published(db,scope.accountId,input.activityId,input.revision);
  const after=identities(await resolve(input.references));if(input.references.some(r=>before.get(r)!==after.get(r)))throw new ParticipationError('ACTIVITY_LEARNER_CHANGED');await financeAuthority(scope,'finance.transactions.record',authorize);
  const results=[];
  for(const reference of input.references){const learner=before.get(reference)!;
   if((await db.query('SELECT id FROM school_finance.activity_charge_links WHERE account_id=$1 AND activity_id=$2 AND learner_person_id=$3',[scope.accountId,input.activityId,learner])).rowCount){results.push({reference,status:'ALREADY_CHARGED' as const});continue;}
   const prior=(await db.query('SELECT id,activity_revision FROM school_finance.activity_offers WHERE account_id=$1 AND activity_id=$2 AND learner_person_id=$3',[scope.accountId,input.activityId,learner])).rows[0];
   if(prior){if(prior.activity_revision!==input.revision)throw new ParticipationError('ACTIVITY_OFFER_CHANGED');results.push({reference,status:'EXISTING' as const,id:prior.id as string});continue;}
   const id=randomUUID();await db.query('INSERT INTO school_finance.activity_offers(id,account_id,activity_id,activity_revision,learner_person_id,offered_by) VALUES($1,$2,$3,$4,$5,$6)',[id,scope.accountId,input.activityId,input.revision,learner,scope.actorPersonId]);await financeAudit(db,scope,'FINANCE_ACTIVITY_OFFERED','ACTIVITY_OFFER',id);results.push({reference,status:'OFFERED' as const,id});
  }
  return {results};
 });
}
