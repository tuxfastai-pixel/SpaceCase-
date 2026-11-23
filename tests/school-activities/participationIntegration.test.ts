import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {initializeFinance,type FinanceAuthority} from '../../domains/school-finance/workspaceService';
import {writeActivityRegister} from '../../domains/school-activities/registerService';import {registerCommand} from '../../domains/school-activities/registerContracts';
import {offerActivity,decideParticipation,readActivityOffers} from '../../domains/school-activities/participationService';
import {readFamilyActivityPlans} from '../../domains/school-activities/familyPlanService';
import type {FamilyBillingDecision} from '../../platform/family/billingContracts';import {samplePolicy} from './fixtures';
test('optional participation: school offers, current parent consent charges once, decline and stale/revoked scopes never charge',{timeout:60000},async t=>{
 if(!process.env.DATABASE_URL){t.skip('Requires isolated PostgreSQL');return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:6}),schoolId=randomUUID(),principal=randomUUID(),officer=randomUUID(),parent=randomUUID(),learner=randomUUID(),grantId=randomUUID();let accountId='';
 const authority=(personId:string):FinanceAuthority=>async school=>({schoolId:school,personId});const scope=(actorPersonId=officer)=>({schoolId,accountId,actorPersonId});
 const write=(value:Record<string,unknown>,actor=officer)=>writeActivityRegister(pool,scope(actor),registerCommand.parse({schoolId,accountId,requestId:randomUUID(),...value}),authority(actor));
 const auth=async(action:FamilyBillingDecision['action']='family.finance.activity.accept',child=learner):Promise<FamilyBillingDecision>=>({allowed:true,contractVersion:'family-billing-v1',grantId,personId:parent,schoolId,learnerPersonId:child,action,expiresAt:new Date(Date.now()+30000).toISOString()});
 try{
  await pool.query('INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)',[schoolId]);accountId=(await initializeFinance(pool,schoolId,principal,authority(principal))).accountId;
  const year=new Date().getUTCFullYear()+1,policy=JSON.parse(JSON.stringify(samplePolicy).replaceAll('2027',String(year)));
  const calendar=await write({command:'SAVE_CALENDAR',expectedVersion:0,policy},principal);
  let activity=await write({command:'CREATE_ACTIVITY',details:{calendarId:calendar.id,title:'Synthetic optional trip',description:'Participation test',audience:'Not eligibility',eventDate:`${year}-12-05`,paymentDeadline:`${year}-11-01`,amountMinor:'15000',optional:true}});
  const input=()=>({activityId:activity.id,revision:activity.revision,learnerReference:'SYN-TEST',eligibilityChecked:true as const});
  await assert.rejects(offerActivity(pool,scope(),input(),authority(officer),async()=>learner),/ACTIVITY_OFFER_CHANGED/);
  for(const [command,actor] of [['SUBMIT_ACTIVITY',officer],['APPROVE_ACTIVITY',principal],['PUBLISH_ACTIVITY',principal]] as const)activity=await write({command,activityId:activity.id,revision:activity.revision,reason:'Synthetic independent check'},actor);
  let lookups=0;await assert.rejects(offerActivity(pool,scope(),input(),authority(officer),async()=>++lookups===1?learner:randomUUID()),/ACTIVITY_LEARNER_CHANGED/);
  const [offer,retry]=await Promise.all([offerActivity(pool,scope(),input(),authority(officer),async()=>learner),offerActivity(pool,scope(),input(),authority(officer),async()=>learner)]);assert.deepEqual(offer,retry);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.invoices WHERE account_id=$1',[accountId])).rows[0].n,0);
  const decision={offerId:offer.id,revision:activity.revision,choice:'ACCEPT' as const,agreementChecked:true as const};
  await assert.rejects(decideParticipation(pool,grantId,decision,()=>auth('family.finance.plan.accept')),/FAMILY_BILLING_FORBIDDEN/);
  await assert.rejects(decideParticipation(pool,grantId,decision,()=>auth('family.finance.activity.accept',randomUUID())),/ACTIVITY_OFFER_UNAVAILABLE/);
  let checks=0;await assert.rejects(decideParticipation(pool,grantId,decision,async()=>{if(++checks>1)throw Error('revoked');return auth();}),/revoked/);
  const db=await pool.connect();let results;
  try{await db.query('SET ROLE spacecase_runtime');const runtime={connect:async()=>({query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}})} as unknown as Pool;
   results=await decideParticipation(runtime,grantId,decision,()=>auth());
   const rights=(await db.query("SELECT has_table_privilege(current_user,'school_finance.activity_offers','UPDATE') AS edit,has_table_privilege(current_user,'school_finance.activity_participations','DELETE') AS erase")).rows[0];assert.deepEqual(rights,{edit:false,erase:false});
  }finally{await db.query('RESET ROLE');db.release();}
  const otherParentId=randomUUID();const secondParent=async()=>({...await auth(),personId:otherParentId});const [a,b]=await Promise.all([decideParticipation(pool,grantId,decision,()=>auth()),decideParticipation(pool,grantId,decision,secondParent)]);assert.deepEqual(a,b);assert.deepEqual(a,results);
  await assert.rejects(decideParticipation(pool,grantId,{...decision,choice:'DECLINE'},()=>auth()),/ACTIVITY_DECISION_ALREADY_SAVED/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.invoices WHERE account_id=$1',[accountId])).rows[0].n,1);
  assert.equal((await pool.query('SELECT amount_minor::text AS amount FROM school_finance.invoices WHERE account_id=$1',[accountId])).rows[0].amount,'15000');
  const visible=await readActivityOffers(pool,grantId,()=>auth('family.finance.read'));assert.equal(visible.offers[0].invoiceId,a.invoiceId);assert.equal(visible.offers[0].choice,'ACCEPT');
  const unrelatedLearner=randomUUID();assert.equal((await readActivityOffers(pool,grantId,()=>auth('family.finance.read',unrelatedLearner))).offers.length,0);
  assert.equal((await readFamilyActivityPlans(pool,grantId,()=>auth('family.finance.read')) as {calendars:unknown[]}).calendars.length,1);
  // Two contacts race the first acceptance, not only retries of an already saved result.
  const racingLearner=randomUUID(),racingOffer=await offerActivity(pool,scope(),input(),authority(officer),async()=>racingLearner),secondGrant=randomUUID(),secondPerson=randomUUID();
  const racingDecision={...decision,offerId:racingOffer.id};
  const racing=await Promise.all([decideParticipation(pool,grantId,racingDecision,()=>auth('family.finance.activity.accept',racingLearner)),decideParticipation(pool,secondGrant,racingDecision,async()=>({...await auth('family.finance.activity.accept',racingLearner),grantId:secondGrant,personId:secondPerson}))]);assert.deepEqual(racing[0],racing[1]);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.invoices WHERE account_id=$1 AND peos_learner_id=$2',[accountId,racingLearner])).rows[0].n,1);
  const declinedLearner=randomUUID(),declined=await offerActivity(pool,scope(),input(),authority(officer),async()=>declinedLearner);
  await decideParticipation(pool,grantId,{...decision,offerId:declined.id,choice:'DECLINE'},()=>auth('family.finance.activity.accept',declinedLearner));
  const staleLearner=randomUUID(),stale=await offerActivity(pool,scope(),input(),authority(officer),async()=>staleLearner);
  await write({command:'CANCEL_ACTIVITY',activityId:activity.id,revision:activity.revision,reason:'Synthetic cancellation'},principal);
  await assert.rejects(decideParticipation(pool,grantId,{...decision,offerId:stale.id},()=>auth('family.finance.activity.accept',staleLearner)),/ACTIVITY_OFFER_CHANGED/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.invoices WHERE account_id=$1',[accountId])).rows[0].n,2);
  for(const table of ['payments','allocations'])assert.equal((await pool.query(`SELECT count(*)::int AS n FROM school_finance.${table} WHERE account_id=$1`,[accountId])).rows[0].n,0);
 }finally{
  if(accountId){for(const table of ['family_activity_plans','activity_participations','activity_offers','activity_charge_links','instalments','invoice_lines','invoices','activity_requests','activity_versions','activity_calendars','audit_events'])await pool.query(`DELETE FROM school_finance.${table} WHERE account_id=$1`,[accountId]);await pool.query('DELETE FROM school_finance.accounts WHERE id=$1',[accountId]);await pool.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[schoolId]);}await pool.end();
 }
});
