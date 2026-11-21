import test from 'node:test';
import assert from 'node:assert/strict';
import {previewFamilyContribution,contributionPreset} from '../../app/parent/finance/contributionPreview';
const id=(n:number)=>`123e4567-e89b-42d3-a456-${String(n).padStart(12,'0')}`;
const charge=(n:number,title:string,amountMinor:string,deadline:string,allocatedMinor='0')=>({chargeId:id(n),activityId:id(n+10),activityRevision:1,invoiceId:id(n+20),invoiceNumber:`DEMO-${n}`,title,deadline,amountMinor,allocatedMinor});
const charges=[charge(1,'Trip','35000','2027-03-10'),charge(2,'School day','25000','2027-02-01'),charge(3,'Year activities','80000','2027-09-01')];
test('parent R700 illustration keeps R200 for a trip and covers nearer activity deadlines with the rest without altering sources',()=>{
 const before=JSON.stringify(charges),result=previewFamilyContribution(charges,'700.00','EARLIEST',id(1),'200.00');assert.equal(result.assignedMinor,'70000');assert.equal(result.remainingMinor,'70000');assert.deepEqual(result.rows.map(r=>[r.title,r.proposedMinor]),[['School day','25000'],['Trip','20000'],['Year activities','25000']]);assert.equal(JSON.stringify(charges),before);
});
test('preview subtracts only confirmed allocations, shows excess separately and rounds half-cent choices explicitly',()=>{
 const current=[charge(1,'Trip','35000','2027-03-10','12500')],result=previewFamilyContribution(current,'700','EARLIEST');assert.equal(result.assignedMinor,'22500');assert.equal(result.unassignedMinor,'47500');assert.equal(result.remainingMinor,'0');assert.equal(contributionPreset([charge(2,'Example','123','2027-04-01')],true),'0.62');assert.equal(contributionPreset(current,false),'225.00');
});
test('parent preview rejects over-reserving, unknown activities and invalid amounts; proportional split conserves every cent',()=>{
 assert.throws(()=>previewFamilyContribution(charges,'100','EARLIEST',id(1),'200'));assert.throws(()=>previewFamilyContribution(charges,'700','EARLIEST',id(9),'20'));assert.throws(()=>previewFamilyContribution(charges,'7.005','EARLIEST'));assert.throws(()=>previewFamilyContribution(charges,'0','EARLIEST'));const result=previewFamilyContribution(charges,'700.01','SPREAD');assert.equal(result.rows.reduce((n,r)=>n+BigInt(r.proposedMinor),0n),70001n);assert.equal(result.unassignedMinor,'0');assert.ok(result.rows.every(r=>BigInt(r.proposedMinor)<=BigInt(r.outstandingMinor)));
});
