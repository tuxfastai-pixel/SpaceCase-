import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {initializeFinance,type FinanceAuthority} from '../../domains/school-finance/workspaceService';
import {writeActivityRegister} from '../../domains/school-activities/registerService';
import {registerCommand} from '../../domains/school-activities/registerContracts';
import {linkActivityCharge,acceptFamilyActivityPlan,previewFamilyActivityPlan,readFamilyActivityPlans,readActivityChargeLinks} from '../../domains/school-activities/familyPlanService';
import {familyPlanDirectory,familyPlanReview} from '../../domains/school-activities/familyPlan';
import type {FamilyPlanChoice} from '../../domains/school-activities/familyPlan';
import type {FamilyBillingDecision} from '../../platform/family/billingContracts';
import {samplePolicy} from './fixtures';
test('family plan persistence serializes retries, locks scope, preserves revisions and cannot create money or overwrite history',{timeout:60000},async t=>{
 if(!process.env.DATABASE_URL){t.skip('Requires isolated PostgreSQL');return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:6}),schoolId=randomUUID(),principal=randomUUID(),officer=randomUUID(),parent=randomUUID(),learner=randomUUID(),grantId=randomUUID();let accountId='';
 const authority=(personId:string):FinanceAuthority=>async school=>({schoolId:school,personId});
 const scope=(actorPersonId=officer)=>({schoolId,accountId,actorPersonId});
 const write=(value:Record<string,unknown>,actor=officer)=>writeActivityRegister(pool,scope(actor),registerCommand.parse({schoolId,accountId,requestId:randomUUID(),...value}),authority(actor));
 const authorize=async():Promise<FamilyBillingDecision>=>({allowed:true,contractVersion:'family-billing-v1',grantId,personId:parent,schoolId,learnerPersonId:learner,action:'family.finance.plan.accept',expiresAt:new Date(Date.now()+30000).toISOString()});
 try{
  await pool.query('INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)',[schoolId]);accountId=(await initializeFinance(pool,schoolId,principal,authority(principal))).accountId;
  const year=Number((await pool.query("SELECT EXTRACT(YEAR FROM now() AT TIME ZONE 'Africa/Johannesburg')::int AS year")).rows[0].year)+1;
  const policy={...JSON.parse(JSON.stringify(samplePolicy).replaceAll('2027',String(year))),paymentOptions:['CUSTOM','FLEXI'] as ('CUSTOM'|'FLEXI')[]};
  const calendar=await write({command:'SAVE_CALENDAR',expectedVersion:0,policy},principal);
  const details={calendarId:calendar.id,title:'Synthetic annual trip',description:'Isolated plan test',audience:'Not an eligibility rule',eventDate:`${year}-12-20`,paymentDeadline:`${year}-12-10`,amountMinor:'35000',optional:true};
  let activity=await write({command:'CREATE_ACTIVITY',details});
  const invoiceId=randomUUID();await pool.query("INSERT INTO school_finance.invoices(id,account_id,peos_learner_id,invoice_number,amount_minor,due_date,created_by_peos_person_id) VALUES($1,$2,$3,$4,35000,$6,$5)",[invoiceId,accountId,learner,`PLAN-${invoiceId}`,officer,`${year}-12-10`]);
  const link=()=>linkActivityCharge(pool,scope(),{activityId:activity.id,revision:activity.revision,invoiceId,eligibilityChecked:true},authority(officer));
  await assert.rejects(link(),/PLAN_ACTIVITY_UNAVAILABLE/);
  activity=await write({command:'SUBMIT_ACTIVITY',activityId:activity.id,revision:activity.revision,reason:'Test ready'});
  activity=await write({command:'APPROVE_ACTIVITY',activityId:activity.id,revision:activity.revision,reason:'Independent test check'},principal);
  activity=await write({command:'PUBLISH_ACTIVITY',activityId:activity.id,revision:activity.revision,reason:'Published test'},principal);
  const [linked,replayed]=await Promise.all([link(),link()]);assert.deepEqual(linked,replayed);
  const duplicate=randomUUID();await pool.query("INSERT INTO school_finance.invoices(id,account_id,peos_learner_id,invoice_number,amount_minor,due_date,created_by_peos_person_id) VALUES($1,$2,$3,$4,35000,$6,$5)",[duplicate,accountId,learner,`PLAN-${duplicate}`,officer,`${year}-12-10`]);
  await assert.rejects(linkActivityCharge(pool,scope(),{activityId:activity.id,revision:activity.revision,invoiceId:duplicate,eligibilityChecked:true},authority(officer)),/PLAN_CHARGE_CONFLICT/);
  const input:FamilyPlanChoice={requestId:randomUUID(),calendarId:calendar.id,expectedRevision:0,selections:[{chargeId:linked.id,expectedOutstandingMinor:'35000'}],option:'FLEXI',flexiDeadlineAcknowledged:true,agreementChecked:true};
  await assert.rejects(acceptFamilyActivityPlan(pool,grantId,input,async()=>({...await authorize(),learnerPersonId:randomUUID()})),/PLAN_ACTIVITY_UNAVAILABLE/);
  await assert.rejects(acceptFamilyActivityPlan(pool,grantId,input,async()=>({...await authorize(),action:'family.finance.read'})),/FAMILY_BILLING_FORBIDDEN/);
  let calls=0;await assert.rejects(acceptFamilyActivityPlan(pool,grantId,input,async()=>{if(++calls>1)throw Error('permission revoked');return authorize();}),/permission revoked/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.family_activity_plans WHERE account_id=$1',[accountId])).rows[0].n,0);
  const readAuthorize=async():Promise<FamilyBillingDecision>=>({...await authorize(),action:'family.finance.read'});
  const offer=familyPlanReview.parse(await previewFamilyActivityPlan(pool,grantId,input,authorize));assert.equal(offer.snapshot.totalOutstandingMinor,'35000');
  await assert.rejects(acceptFamilyActivityPlan(pool,grantId,input,authorize,'0'.repeat(64)),/PLAN_REVIEW_CHANGED/);
  const before=familyPlanDirectory.parse(await readFamilyActivityPlans(pool,grantId,readAuthorize));assert.equal(before.calendars[0].charges[0].chargeId,linked.id);assert.equal(before.plans.length,0);
  assert.deepEqual(await readFamilyActivityPlans(pool,grantId,readAuthorize,input.requestId),{status:'NOT_FOUND'});
  const [one,two]=await Promise.all([acceptFamilyActivityPlan(pool,grantId,input,authorize,offer.reviewDigest),acceptFamilyActivityPlan(pool,grantId,input,authorize,offer.reviewDigest)]);assert.deepEqual(one,two);
  assert.deepEqual(await readFamilyActivityPlans(pool,grantId,readAuthorize,input.requestId),{status:'SAVED',...one});
  const visible=familyPlanDirectory.parse(await readFamilyActivityPlans(pool,grantId,readAuthorize));assert.equal(visible.plans[0].id,one.id);for(const secret of ['actor_person_id','actorPersonId','grant_id','request_id','digest'])assert.equal(JSON.stringify(visible).includes(secret),false);
  const otherLearner=randomUUID();const other=async():Promise<FamilyBillingDecision>=>({...await readAuthorize(),learnerPersonId:otherLearner});const hidden=familyPlanDirectory.parse(await readFamilyActivityPlans(pool,grantId,other));assert.equal(hidden.plans.length,0);assert.equal(hidden.calendars.length,0);
  const otherParent=randomUUID();assert.deepEqual(await readFamilyActivityPlans(pool,grantId,async()=>({...await readAuthorize(),personId:otherParent}),input.requestId),{status:'NOT_FOUND'});
  let revokedReads=0;await assert.rejects(readFamilyActivityPlans(pool,grantId,async()=>{if(++revokedReads>1)throw Error('read revoked');return readAuthorize();}),/read revoked/);
  assert.equal((await readActivityChargeLinks(pool,scope(),authority(officer))).links[0].id,linked.id);
  await assert.rejects(acceptFamilyActivityPlan(pool,grantId,{...input,expectedRevision:1},authorize),/PLAN_REQUEST_CONFLICT/);
  await assert.rejects(acceptFamilyActivityPlan(pool,grantId,{...input,requestId:randomUUID()},authorize),/PLAN_REVISION_CHANGED/);
  const revised={...input,requestId:randomUUID(),expectedRevision:1};const outcomes=await Promise.allSettled([acceptFamilyActivityPlan(pool,grantId,revised,authorize),acceptFamilyActivityPlan(pool,grantId,{...revised,requestId:randomUUID()},authorize)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  const rows=(await pool.query('SELECT revision,snapshot FROM school_finance.family_activity_plans WHERE account_id=$1 ORDER BY revision',[accountId])).rows;assert.deepEqual(rows.map(r=>r.revision),[1,2]);assert.equal(rows[0].snapshot.totalOutstandingMinor,'35000');assert.equal(rows[0].snapshot.charges[0].invoiceId,invoiceId);
  const runtime=await pool.connect();try{await runtime.query('SET ROLE spacecase_runtime');const rights=(await runtime.query("SELECT has_table_privilege(current_user,'school_finance.family_activity_plans','UPDATE') AS overwrite,has_table_privilege(current_user,'school_finance.family_activity_plans','DELETE') AS deletion,has_table_privilege(current_user,'school_finance.activity_charge_links','INSERT') AS linking")).rows[0];assert.deepEqual(rights,{overwrite:false,deletion:false,linking:true});
   const db={connect:async()=>({query:(sql:string,args?:unknown[])=>runtime.query(sql,args),release:()=>{}})} as unknown as Pool;
   assert.deepEqual(await acceptFamilyActivityPlan(db,grantId,input,authorize),one);
  }finally{await runtime.query('RESET ROLE');runtime.release();}
  const newerCalendar=await write({command:'SAVE_CALENDAR',expectedVersion:1,policy:{...policy,label:'Later school policy'}},principal);
  await assert.rejects(acceptFamilyActivityPlan(pool,grantId,{...input,requestId:randomUUID(),calendarId:newerCalendar.id,expectedRevision:2},authorize),/PLAN_ACTIVITY_UNAVAILABLE/);
  const third=await acceptFamilyActivityPlan(pool,grantId,{...input,requestId:randomUUID(),expectedRevision:2},authorize);assert.equal(third.revision,3);
  // Old request lookup remains valid after policy changes, but still requires current permission.
  assert.deepEqual(await acceptFamilyActivityPlan(pool,grantId,input,authorize),one);
  await write({command:'CANCEL_ACTIVITY',activityId:activity.id,revision:activity.revision,reason:'Cancelled test'},principal);
  await assert.rejects(acceptFamilyActivityPlan(pool,grantId,{...input,requestId:randomUUID(),expectedRevision:3},authorize),/PLAN_ACTIVITY_UNAVAILABLE/);
  const history=familyPlanDirectory.parse(await readFamilyActivityPlans(pool,grantId,readAuthorize));assert.equal(history.calendars.length,0);assert.deepEqual(history.plans.map(p=>p.revision),[3,2,1]);
  assert.equal((await pool.query('SELECT snapshot FROM school_finance.family_activity_plans WHERE id=$1',[one.id])).rows[0].snapshot.policy.label,policy.label);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.payments WHERE account_id=$1',[accountId])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.allocations WHERE account_id=$1',[accountId])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.invoices WHERE account_id=$1',[accountId])).rows[0].n,2);
 }finally{
  if(accountId){for(const table of ['family_activity_plans','activity_charge_links','activity_requests','activity_versions','activity_calendars','invoices','audit_events'])await pool.query(`DELETE FROM school_finance.${table} WHERE account_id=$1`,[accountId]);await pool.query('DELETE FROM school_finance.accounts WHERE id=$1',[accountId]);await pool.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[schoolId]);}await pool.end();
 }
});
