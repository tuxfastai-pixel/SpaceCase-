import test from 'node:test';
import assert from 'node:assert/strict';
import {buildActivityPreview,type DraftActivity} from '../../app/finance/activityPlanningModel';
const events:DraftActivity[]=[{id:'trip',title:'Trip',amount:'350',deadline:'2027-03-10',chosen:''},{id:'day',title:'School day',amount:'250',deadline:'2027-02-01',chosen:''}];
test('the short staff preview works without payment dates and prioritises the closest deadline',()=>{
 const before=JSON.stringify(events),preview=buildActivityPreview(events,'300');assert.equal(preview.total,'60000');assert.deepEqual(preview.distribution.rows.map(r=>[r.id,r.proposedMinor]),[['day','25000'],['trip','5000']]);assert.equal(preview.distribution.remainingMinor,'30000');assert.deepEqual(preview.schedule,[]);assert.deepEqual(preview.shortfalls,[]);assert.equal(preview.scheduled,false);assert.equal(JSON.stringify(events),before);
});
test('advanced scheduled amounts retain exact sums and warn about early funding gaps',()=>{
 const preview=buildActivityPreview(events,'100',{mode:'EARLIEST',scheduled:true,dates:[{date:'2027-04-01',amount:'200'},{date:'2027-05-01',amount:'300'}],variable:true});assert.deepEqual(preview.schedule.map(r=>r.amountMinor),['20000','30000']);assert.equal(preview.shortfalls[0].deadline,'2027-02-01');assert.equal(preview.shortfalls[0].shortfallMinor,'15000');assert.throws(()=>buildActivityPreview(events,'100',{mode:'EARLIEST',scheduled:true,dates:[{date:'2027-04-01',amount:'499'}],variable:true}));
});
test('manual sharing remains explicit and invalid dates matter only when scheduling is requested',()=>{
 const custom=events.map(r=>({...r,chosen:r.id==='trip'?'200':''}));const preview=buildActivityPreview(custom,'300',{mode:'CUSTOM',scheduled:false,dates:[{date:'',amount:''}],variable:false});assert.equal(preview.distribution.unassignedMinor,'10000');assert.equal(preview.distribution.rows.find(r=>r.id==='trip')?.proposedMinor,'20000');assert.throws(()=>buildActivityPreview(events,'300',{mode:'EARLIEST',scheduled:true,dates:[{date:'',amount:''}],variable:false}),/Complete payment date 1/);
});
