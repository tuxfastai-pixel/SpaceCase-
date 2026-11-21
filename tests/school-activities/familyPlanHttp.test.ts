import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {Pool} from 'pg';
import {familyActivityPlanHandler} from '../../platform/family/activityPlanHttp';import {activityChargeHandler} from '../../platform/finance/activityChargeHttp';
import {FamilyBillingError} from '../../platform/family/billingAuthority';import {acceptFamilyActivityPlan,previewFamilyActivityPlan,readFamilyActivityPlans} from '../../domains/school-activities/familyPlanService';
import {familyBillingStaff} from '../../platform/family/billingStaffHttp';
test('family plan routes default off, enforce origin and bounded strict input, and use separate read/accept permissions',async()=>{
 const keys=['SPACECASE_FAMILY_FINANCE_ENABLED','SPACECASE_FINANCE_WORKSPACE_ENABLED','SPACECASE_WORKSPACE_MODE','SPACECASE_ACTIVITY_REGISTER_ENABLED','SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED','SPACECASE_PUBLIC_URL'];const saved={...process.env};let pools=0;const actions:string[]=[];
 const handler=familyActivityPlanHandler({pool:()=>{pools++;return {} as Pool;},authorize:async(_r,_id,action)=>{actions.push(action);throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');},read:readFamilyActivityPlans,preview:previewFamilyActivityPlan,accept:acceptFamilyActivityPlan});
 const id=randomUUID(),url='https://school.test/api/v1/family/activity-plans';
 const choice={requestId:randomUUID(),calendarId:randomUUID(),expectedRevision:0,selections:[{chargeId:randomUUID(),expectedOutstandingMinor:'35000'}],option:'FLEXI',flexiDeadlineAcknowledged:true};
 const post=(value:unknown,origin='https://school.test')=>new Request(url,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});
 try{
  delete process.env.SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED;assert.equal((await handler(new Request(url))).status,503);
  Object.assign(process.env,{SPACECASE_FAMILY_FINANCE_ENABLED:'true',SPACECASE_FINANCE_WORKSPACE_ENABLED:'true',SPACECASE_WORKSPACE_MODE:'operational',SPACECASE_ACTIVITY_REGISTER_ENABLED:'true',SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED:'true',SPACECASE_PUBLIC_URL:'https://school.test'});
  assert.equal((await handler(post({},'https://other.test'))).status,403);
  for(const suffix of [`?grantId=${id}&grantId=${id}`,`?grantId=${id}&schoolId=${randomUUID()}`,`?grantId=${id}&learnerPersonId=${randomUUID()}`])assert.equal((await handler(new Request(url+suffix))).status,400);
  assert.equal((await handler(post({command:'ACCEPT',grantId:id,choice:{...choice,agreementChecked:false},reviewDigest:'0'.repeat(64)}))).status,400);
  assert.equal((await handler(post({command:'ACCEPT',grantId:id,choice:{...choice,agreementChecked:true}}))).status,400);
  assert.equal((await handler(post({command:'PREVIEW',grantId:id,choice:{...choice,amountMinor:'1'}}))).status,400);
  assert.equal((await handler(post({padding:'x'.repeat(25000)}))).status,413);assert.equal(pools,0);
  assert.equal((await handler(new Request(`${url}?grantId=${id}`))).status,403);assert.equal(actions.pop(),'family.finance.read');
  const preview=await handler(post({command:'PREVIEW',grantId:id,choice}));assert.equal(preview.status,403);assert.equal(actions.pop(),'family.finance.plan.accept');assert.equal(preview.headers.get('cache-control'),'private, no-store');
  assert.equal((await handler(post({command:'ACCEPT',grantId:id,choice:{...choice,agreementChecked:true},reviewDigest:'0'.repeat(64)}))).status,403);assert.equal(actions.pop(),'family.finance.plan.accept');
  const staff=activityChargeHandler({pool:()=>{throw Error('storage not expected');},permission:async()=>{throw Error('permission not expected');}});
  assert.equal((await staff(new Request('https://school.test/api/finance/activity-charges',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}))).status,403);
  assert.equal((await staff(new Request(`https://school.test/api/finance/activity-charges?schoolId=${id}&accountId=${randomUUID()}&unexpected=1`))).status,400);
  delete process.env.SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED;
  assert.equal((await familyBillingStaff(new Request(`https://school.test/api/finance/family-billing?schoolId=${id}`,{method:'POST',headers:{origin:'https://school.test'},body:JSON.stringify({relationshipId:randomUUID(),actions:['family.finance.read','family.finance.plan.accept'],billingAuthorityChecked:true})}))).status,403);
  assert.equal((await handler(new Request(`${url}?grantId=${id}`))).status,503);
 }finally{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
