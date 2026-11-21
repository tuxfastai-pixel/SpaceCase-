import {test} from 'node:test';import assert from 'node:assert/strict';import {calendarPolicy,nextActivityState,activityDetails} from '../../domains/school-activities/registerContracts';
import {samplePolicy} from './fixtures';
test('calendar preserves four school terms and explicitly configured halves without overlaps',()=>{
 assert.equal(calendarPolicy.parse(samplePolicy).halves[0].end,'2027-06-30');
 assert.equal(calendarPolicy.safeParse({...samplePolicy,halves:[{start:'2027-01-01',end:'2027-02-01'},samplePolicy.halves[1]]}).success,false);
 assert.equal(calendarPolicy.safeParse({...samplePolicy,terms:[samplePolicy.terms[0],samplePolicy.terms[0],...samplePolicy.terms.slice(2)]}).success,false);
 assert.equal(calendarPolicy.safeParse({...samplePolicy,paymentOptions:['FLEXI','FLEXI']}).success,false);
});
test('activity state machine preserves independent approval and requires approval before publication',()=>{
 assert.equal(nextActivityState('DRAFT','SUBMIT_ACTIVITY',true),'SUBMITTED');assert.throws(()=>nextActivityState('SUBMITTED','APPROVE_ACTIVITY',true));assert.throws(()=>nextActivityState('SUBMITTED','REJECT_ACTIVITY',true));assert.equal(nextActivityState('SUBMITTED','APPROVE_ACTIVITY',false),'APPROVED');assert.equal(nextActivityState('APPROVED','PUBLISH_ACTIVITY',false),'PUBLISHED');assert.throws(()=>nextActivityState('DRAFT','PUBLISH_ACTIVITY',false));assert.throws(()=>nextActivityState('PUBLISHED','EDIT_ACTIVITY',true));assert.equal(nextActivityState('REJECTED','EDIT_ACTIVITY',true),'DRAFT');assert.throws(()=>nextActivityState('DRAFT','EDIT_ACTIVITY',false));
});
test('activity costs and dates reject unsupported zero charges and payment after event',()=>{
 const details={calendarId:'10000000-0000-4000-8000-000000000001',title:'Trip',description:'Test activity',audience:'Grade 4',eventDate:'2027-05-10',paymentDeadline:'2027-05-01',amountMinor:'35000',optional:true};assert.equal(activityDetails.safeParse(details).success,true);assert.equal(activityDetails.safeParse({...details,paymentDeadline:'2027-05-11'}).success,false);assert.equal(activityDetails.safeParse({...details,amountMinor:'0'}).success,false);
});
