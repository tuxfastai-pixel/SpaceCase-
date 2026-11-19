import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildFamilyPlan,approvedPlanDates,familyPlanChoice,type FamilyPlanChoice} from '../../domains/school-activities/familyPlan';
import type {CalendarPolicy} from '../../domains/school-activities/registerContracts';
import {samplePolicy} from './fixtures';
const calendarId=randomUUID(),chargeId=randomUUID();
const policy:CalendarPolicy={...samplePolicy,paymentOptions:['MONTHLY','EVERY_TWO_MONTHS','TERM','HALF_YEAR','CUSTOM','FLEXI']};
const charge={chargeId,activityId:randomUUID(),activityRevision:4,invoiceId:randomUUID(),invoiceNumber:'TEST-TRIP-1',title:'School trip',deadline:'2027-12-10',amountMinor:'35000',allocatedMinor:'0'};
const choice:FamilyPlanChoice={requestId:randomUUID(),calendarId,expectedRevision:0,selections:[{chargeId,expectedOutstandingMinor:'35000'}],option:'CUSTOM',instalments:[{dueDate:'2027-02-01',amountMinor:'20000'},{dueDate:'2027-03-01',amountMinor:'15000'}],flexiDeadlineAcknowledged:false,agreementChecked:true};
const source=()=>({calendarId,policy:structuredClone(policy),charges:[{...charge}],today:'2027-01-01'});
test('agreement snapshots preserve exact variable contributions and original policy after source changes',()=>{
 const src=source(),result=buildFamilyPlan(choice,src);src.policy.label='Changed later';src.charges[0].title='Changed later';assert.equal(result.policy.label,samplePolicy.label);assert.equal(result.charges[0].title,'School trip');assert.equal(result.totalOutstandingMinor,'35000');assert.deepEqual(result.instalments,choice.instalments);
});
test('only selected current learner charge IDs are usable; browser prices, identities and duplicate selections rejected',()=>{
 assert.throws(()=>buildFamilyPlan({...choice,selections:[{chargeId:randomUUID(),expectedOutstandingMinor:'35000'}]},source()),/PLAN_ACTIVITY_UNAVAILABLE/);
 assert.equal(familyPlanChoice.safeParse({...choice,learnerPersonId:randomUUID()}).success,false);
 assert.equal(familyPlanChoice.safeParse({...choice,selections:[{...choice.selections[0],amountMinor:'1'}]}).success,false);
 assert.equal(familyPlanChoice.safeParse({...choice,selections:[choice.selections[0],choice.selections[0]]}).success,false);
});
test('fresh allocations invalidate stale reviewed amounts and settled charges cannot be committed again',()=>{
 const src=source();src.charges[0].allocatedMinor='10000';assert.throws(()=>buildFamilyPlan(choice,src),/PLAN_BALANCE_CHANGED/);
 const updated={...choice,selections:[{chargeId,expectedOutstandingMinor:'25000'}],instalments:[{dueDate:'2027-02-01',amountMinor:'25000'}]};assert.equal(buildFamilyPlan(updated,src).totalOutstandingMinor,'25000');
 src.charges[0].allocatedMinor='35000';assert.throws(()=>buildFamilyPlan(choice,src),/PLAN_BALANCE_CHANGED/);
});
test('fixed instalments must cover every deadline, school minimum and exact remaining total',()=>{
 const src=source();src.charges[0].deadline='2027-02-15';assert.throws(()=>buildFamilyPlan(choice,src),/PLAN_MISSES_ACTIVITY_DEADLINE/);
 assert.throws(()=>buildFamilyPlan({...choice,instalments:[{dueDate:'2027-02-01',amountMinor:'500'},{dueDate:'2027-03-01',amountMinor:'34500'}]},source()),/PLAN_BELOW_SCHOOL_MINIMUM/);
 assert.throws(()=>buildFamilyPlan({...choice,instalments:[{dueDate:'2027-02-01',amountMinor:'34999'}]},source()),/add up exactly/);
});
test('Flexi explicitly acknowledges deadlines and never manufactures a payment or a fixed schedule',()=>{
 const flexi={...choice,option:'FLEXI' as const,instalments:undefined,flexiDeadlineAcknowledged:true};const result=buildFamilyPlan(flexi,source());assert.deepEqual(result.instalments,[]);assert.deepEqual(result.shortfalls,[{deadline:'2027-12-10',shortfallMinor:'35000'}]);assert.equal(result.charges[0].allocatedMinor,'0');assert.throws(()=>buildFamilyPlan({...flexi,flexiDeadlineAcknowledged:false},source()),/PLAN_FLEXI_ACKNOWLEDGEMENT_REQUIRED/);assert.throws(()=>buildFamilyPlan({...flexi,instalments:choice.instalments},source()),/PLAN_FLEXI_ACKNOWLEDGEMENT_REQUIRED/);
});
test('school-defined terms and half-years determine dates; unavailable options and past dates fail closed',()=>{
 assert.deepEqual(approvedPlanDates(policy,'TERM','2027-04-01','2027-03-01'),['2027-04-01','2027-07-01','2027-10-01']);assert.deepEqual(approvedPlanDates(policy,'HALF_YEAR','2027-01-01','2027-01-01'),['2027-01-01','2027-07-01']);assert.throws(()=>approvedPlanDates(policy,'TERM','2027-04-02','2027-01-01'),/PLAN_DATES_UNAVAILABLE/);assert.throws(()=>approvedPlanDates(policy,'MONTHLY','2027-01-01','2027-01-02'),/PLAN_DATES_UNAVAILABLE/);
 const src=source();src.policy.paymentOptions=['FLEXI'];assert.throws(()=>buildFamilyPlan(choice,src),/PLAN_POLICY_CHANGED/);
});
test('monthly dates retain chosen day after short months, every-two-months and cents remain exact',()=>{
 const dates=approvedPlanDates(policy,'MONTHLY','2027-01-31','2027-01-01');assert.deepEqual(dates.slice(0,3),['2027-01-31','2027-02-28','2027-03-31']);assert.deepEqual(approvedPlanDates(policy,'EVERY_TWO_MONTHS','2027-01-31','2027-01-01').slice(0,3),['2027-01-31','2027-03-31','2027-05-31']);
 const src=source();src.charges[0].amountMinor='35001';src.charges[0].deadline='2027-12-31';const result=buildFamilyPlan({...choice,selections:[{chargeId,expectedOutstandingMinor:'35001'}],option:'MONTHLY',instalments:undefined,firstDueDate:'2027-01-31'},src);assert.equal(result.instalments.reduce((n,p)=>n+BigInt(p.amountMinor),0n),35001n);
});
test('duplicate invoice links, invalid totals and missing agreement cannot become accepted plans',()=>{
 const src=source();src.charges.push({...charge,chargeId:randomUUID()});assert.throws(()=>buildFamilyPlan(choice,src),/PLAN_CHARGE_CONFLICT/);assert.equal(familyPlanChoice.safeParse({...choice,agreementChecked:false}).success,false);assert.throws(()=>buildFamilyPlan({...choice,calendarId:randomUUID()},source()),/PLAN_POLICY_CHANGED/);
});
