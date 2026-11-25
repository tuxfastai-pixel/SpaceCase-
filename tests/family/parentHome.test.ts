import test from 'node:test';
import assert from 'node:assert/strict';
import {parentHomeState,parentLandingDestination,readParentHome,familyConnectionsSchema} from '../../platform/family/home';
import {familyBillingDirectory} from '../../platform/family/billingContracts';
const id='123e4567-e89b-42d3-a456-426614174000',now=Date.parse('2026-11-21T10:00:00Z');
const connection=(status:string)=>familyConnectionsSchema.parse({connections:[{id,schoolName:'Example school',relationship:'PARENT',status,requestedAt:'2026-11-20T10:00:00Z',reviewedAt:null,grantsLearnerAccess:false}],nextOffset:null});
const directory=(plan=false,expiresAt='2026-12-01T10:00:00Z')=>familyBillingDirectory.parse({contractVersion:'family-billing-v1',scopes:[{grantId:id,schoolId:id,learnerPersonId:id,schoolName:'Example school',learnerReference:'DEMO-1',givenName:'Example',familyName:'Learner',actions:plan?['family.finance.read','family.finance.plan.accept']:['family.finance.read'],expiresAt}],truncated:false});
test('contact confirmation alone never opens financial tools or reveals learner names',()=>{
 const home=parentHomeState({connections:connection('CONFIRMED'),directory:null,plansEnabled:true,incomplete:false},now);
 assert.equal(home.stage,'CONNECTED');assert.equal(home.canOpenAccount,false);assert.equal(home.canPlan,false);assert.deepEqual(home.learners,[]);assert.equal(parentLandingDestination(0,home),'/parent');
});
test('current grants open the account and require both current plan authority and feature availability',()=>{
 const input={connections:null,directory:directory(true),plansEnabled:true,incomplete:false};const home=parentHomeState(input,now);
 assert.equal(home.stage,'READY');assert.equal(home.canPlan,true);assert.equal(home.learners[0].name,'Example Learner');assert.equal('grantId' in home.learners[0],false);assert.equal('learnerPersonId' in home.learners[0],false);
 assert.equal(parentHomeState({...input,plansEnabled:false},now).canPlan,false);
 assert.equal(parentHomeState({...input,directory:directory(false)},now).canPlan,false);
 assert.equal(parentLandingDestination(1,home),null);
});
test('expired or revoked access removes account tools while retaining the connection next step',()=>{
 const input={connections:connection('CONFIRMED'),directory:directory(true,'2026-11-21T09:00:00Z'),plansEnabled:true,incomplete:false};
 const expired=parentHomeState(input,now);assert.equal(expired.canOpenAccount,false);assert.deepEqual(expired.learners,[]);assert.equal(expired.stage,'CONNECTED');
 assert.equal(parentHomeState({...input,connections:connection('REVOKED'),directory:null},now).stage,'ATTENTION');
 assert.equal(parentHomeState({...input,connections:connection('PENDING_SCHOOL_REVIEW'),directory:null},now).stage,'WAITING');
});
test('unknown accounts do not infer a parent role and service failures do not suggest starting over',()=>{
 const input={connections:null,directory:null,plansEnabled:true,incomplete:false};
 assert.equal(parentLandingDestination(0,parentHomeState(input,now)),null);
 const failed=parentHomeState({...input,incomplete:true},now);assert.equal(failed.stage,'UNAVAILABLE');assert.equal(failed.canOpenAccount,false);assert.equal(parentLandingDestination(0,failed),null);
});
test('independent directory failures clear grant-derived data and disabled services are never queried',async()=>{
 const deps={connections:async()=>connection('CONFIRMED'),directory:async()=>{throw Error('offline');},connectionsEnabled:true,financeEnabled:true,plansEnabled:true};
 const home=await readParentHome(new Request('https://school.example/parent'),deps);assert.equal(home.stage,'CONNECTED');assert.equal(home.accessCheckIncomplete,true);assert.equal(home.canOpenAccount,false);
 const disabled=await readParentHome(new Request('https://school.example/parent'),{...deps,connections:async()=>{throw Error('must not run');},connectionsEnabled:false,financeEnabled:false});assert.equal(disabled.stage,'START');assert.equal(disabled.accessCheckIncomplete,false);
});
