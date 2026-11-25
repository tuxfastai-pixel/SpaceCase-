import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {Pool} from 'pg';
import {parentParticipationHandler,staffOfferHandler} from '../../platform/family/participationHttp';
import {FamilyBillingError} from '../../platform/family/billingAuthority';
import {readActivityOffers,decideParticipation} from '../../domains/school-activities/participationService';
test('participation routes default off; bounded, same-origin and explicit charge authority, never plan permission',async()=>{
 const keys=['SPACECASE_FAMILY_FINANCE_ENABLED','SPACECASE_FINANCE_WORKSPACE_ENABLED','SPACECASE_WORKSPACE_MODE','SPACECASE_ACTIVITY_REGISTER_ENABLED','SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED','SPACECASE_OPTIONAL_ACTIVITY_PARTICIPATION_ENABLED','SPACECASE_PUBLIC_URL'];const saved={...process.env},actions:string[]=[];let pools=0;
 const handler=parentParticipationHandler({pool:()=>{pools++;return {} as Pool;},authorize:async(_r,_id,action)=>{actions.push(action);throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');},read:readActivityOffers,decide:decideParticipation});
 const url='https://school.test/api/v1/family/activity-participation',grantId=randomUUID(),decision={offerId:randomUUID(),revision:4,choice:'ACCEPT',agreementChecked:true};
 const post=(body:unknown,origin='https://school.test')=>new Request(url,{method:'POST',headers:{origin},body:JSON.stringify(body)});
 try{
  delete process.env.SPACECASE_OPTIONAL_ACTIVITY_PARTICIPATION_ENABLED;assert.equal((await handler(new Request(url))).status,503);
  Object.assign(process.env,{SPACECASE_FAMILY_FINANCE_ENABLED:'true',SPACECASE_FINANCE_WORKSPACE_ENABLED:'true',SPACECASE_WORKSPACE_MODE:'operational',SPACECASE_ACTIVITY_REGISTER_ENABLED:'true',SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED:'true',SPACECASE_OPTIONAL_ACTIVITY_PARTICIPATION_ENABLED:'true',SPACECASE_PUBLIC_URL:'https://school.test'});
  assert.equal((await handler(post({},'https://other.test'))).status,403);
  assert.equal((await handler(new Request(`${url}?grantId=${grantId}&grantId=${grantId}`))).status,400);
  for(const extra of [{learnerPersonId:randomUUID()},{amountMinor:'1'},{schoolId:randomUUID()}])assert.equal((await handler(post({grantId,decision:{...decision,...extra}}))).status,400);
  assert.equal((await handler(post({grantId,decision:{...decision,agreementChecked:false}}))).status,400);
  assert.equal((await handler(post({padding:'x'.repeat(5000)}))).status,413);assert.equal(pools,0);
  assert.equal((await handler(new Request(`${url}?grantId=${grantId}`))).status,403);assert.equal(actions.pop(),'family.finance.read');
  const result=await handler(post({grantId,decision}));assert.equal(result.status,403);assert.equal(actions.pop(),'family.finance.activity.accept');assert.equal(result.headers.get('cache-control'),'private, no-store');
  const staff=staffOfferHandler({pool:()=>{throw Error('unexpected storage');},permission:async()=>{throw Error('unexpected authority');},learner:async()=>{throw Error('unexpected learner lookup');},offer:async()=>{throw Error('unexpected offer');}});
  assert.equal((await staff(post({},'https://other.test'))).status,403);
  assert.equal((await staff(post({schoolId:randomUUID(),accountId:randomUUID(),offer:{activityId:randomUUID(),revision:4,learnerReference:'SYN',eligibilityChecked:false}}))).status,400);
 }finally{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
