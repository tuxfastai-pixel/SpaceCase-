import {test} from 'node:test';import assert from 'node:assert/strict';
import {activityBalances,distributeContribution,contributionSchedule,deadlineShortfalls} from '../../domains/school-activities/contributions';
const activities=[{id:'trip',title:'Trip',deadline:'2027-03-01',amountMinor:'35000',verifiedMinor:'0'},{id:'sports',title:'Sports',deadline:'2027-05-01',amountMinor:'50000',verifiedMinor:'0'},{id:'yearend',title:'Year end',deadline:'2027-10-01',amountMinor:'55000',verifiedMinor:'0'}];
test('half contribution keeps a chosen trip split and funds other events by deadline',()=>{
 const result=distributeContribution(activities,'70000','EARLIEST',{trip:'20000'});
 assert.deepEqual(result.rows.map(r=>[r.id,r.proposedMinor,r.remainingMinor]),[['trip','20000','15000'],['sports','50000','0'],['yearend','0','55000']]);assert.equal(result.remainingMinor,'70000');assert.equal(result.unassignedMinor,'0');
});
test('default priority is payment deadline, regardless of price or input order',()=>{
 const result=distributeContribution([...activities].reverse(),'70000','EARLIEST');assert.deepEqual(result.rows.map(r=>r.proposedMinor),['35000','35000','0']);
});
test('proportional split preserves every cent deterministically and cannot over-allocate',()=>{
 const result=distributeContribution(activities,'101','SPREAD');assert.equal(result.rows.reduce((n,r)=>n+BigInt(r.proposedMinor),0n),101n);assert.deepEqual(distributeContribution([...activities].reverse(),'101','SPREAD').rows,result.rows);
 assert.equal(distributeContribution(activities,'150000','SPREAD').unassignedMinor,'10000');assert.equal(distributeContribution(activities,'150000','EARLIEST').remainingMinor,'0');
});
test('custom split validates references and limits and leaves excess visibly unassigned',()=>{
 assert.throws(()=>distributeContribution(activities,'100','CUSTOM',{trip:'101'}));assert.throws(()=>distributeContribution(activities,'70000','CUSTOM',{missing:'10'}));assert.throws(()=>distributeContribution(activities,'70000','CUSTOM',{trip:'35001'}));
 assert.equal(distributeContribution(activities,'70000','CUSTOM',{trip:'20000'}).unassignedMinor,'50000');assert.throws(()=>distributeContribution(activities,'0','EARLIEST'));
});
test('only verified activity allocations reduce the planning balance; invalid balances and duplicate events fail',()=>{
 assert.equal(activityBalances(activities).outstandingMinor,'140000');assert.equal(activityBalances([{...activities[0],verifiedMinor:'20000'}]).outstandingMinor,'15000');
 assert.throws(()=>activityBalances([activities[0],activities[0]]));assert.throws(()=>activityBalances([{...activities[0],verifiedMinor:'35001'}]));assert.throws(()=>activityBalances([{...activities[0],deadline:'2027-02-30'}]));
});
test('school-defined instalment dates and variable amounts conserve the exact remaining balance',()=>{
 assert.deepEqual(contributionSchedule('70001',['2027-01-15','2027-07-20']).map(p=>p.amountMinor),['35001','35000']);
 assert.deepEqual(contributionSchedule('70000',['2027-01-15','2027-07-20'],['20000','50000']).map(p=>p.amountMinor),['20000','50000']);
 assert.throws(()=>contributionSchedule('70000',['2027-01-15','2027-07-20'],['20000','40000']));assert.throws(()=>contributionSchedule('70000',['2027-01-15','2027-01-15']));assert.deepEqual(contributionSchedule('0',[]),[]);
});
test('combined annual affordability never hides an early event shortfall',()=>{
 const rows=distributeContribution(activities,'70000','EARLIEST',{trip:'20000'}).rows;
 assert.deepEqual(deadlineShortfalls(rows,contributionSchedule('70000',['2027-04-01','2027-09-01'])),[{deadline:'2027-03-01',shortfallMinor:'15000'}]);
 assert.deepEqual(deadlineShortfalls(rows,contributionSchedule('70000',['2027-02-01','2027-09-01'])),[]);
});
