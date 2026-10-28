import test from 'node:test';import assert from 'node:assert/strict';import {invoiceTotal,MAX_MINOR_UNITS,minorUnits,planVerifiedAllocation,splitInstalments} from '../../domains/school-finance/money';
test('school invoices use exact integer cents and reject malformed/overflowing values',()=>{
 assert.equal(invoiceTotal([{quantity:3,unitPriceMinor:'10'},{quantity:1,unitPriceMinor:'20'}]),'50');
 assert.equal(invoiceTotal([{quantity:1,unitPriceMinor:'9007199254740993'}]),'9007199254740993');
 for(const value of ['-1','0.01','1e3','01',' 10','Infinity',(MAX_MINOR_UNITS+1n).toString()])assert.throws(()=>minorUnits(value));
 assert.throws(()=>invoiceTotal([{quantity:2,unitPriceMinor:MAX_MINOR_UNITS.toString()}]),/AMOUNT_OVERFLOW/);
 assert.throws(()=>invoiceTotal([{quantity:1.5,unitPriceMinor:'100'}]),/INVALID_QUANTITY/);
});
test('instalments preserve every cent and differ by at most one cent',()=>{
 assert.deepEqual(splitInstalments('10000',3),['3334','3333','3333']);
 for(const total of ['1','101','123456789','9007199254740993'])for(const count of [1,2,3,12,60]){if(BigInt(total)<BigInt(count))continue;const parts=splitInstalments(total,count).map(BigInt);assert.equal(parts.reduce((a,b)=>a+b,0n),BigInt(total));assert.ok(parts.every(p=>p>0n));assert.ok(parts[0]-parts[parts.length-1]<=1n);}
 assert.throws(()=>splitInstalments('2',3),/INVALID_INSTALMENT_COUNT/);assert.throws(()=>splitInstalments('100',0));
});
test('allocation plans require verified same-school/account payments and preserve unused money',()=>{
 const facts={schoolId:'school-a',accountId:'account-a',currency:'ZAR' as const};
 const payment={...facts,verification:'VERIFIED' as const,amountMinor:'15000',availableMinor:'15000'};
 const invoice={...facts,status:'ISSUED' as const,totalMinor:'10000',outstandingMinor:'10000'};
 assert.deepEqual(planVerifiedAllocation(payment,invoice,'10000'),{allocatedMinor:'10000',paymentAvailableAfter:'5000',invoiceOutstandingAfter:'0'});
 for(const verification of ['REPORTED','REJECTED'] as const)assert.throws(()=>planVerifiedAllocation({...payment,verification},invoice,'100'),/VERIFIED_PAYMENT_REQUIRED/);
 assert.throws(()=>planVerifiedAllocation(payment,{...invoice,schoolId:'school-b'},'100'),/ALLOCATION_SCOPE_MISMATCH/);
 assert.throws(()=>planVerifiedAllocation(payment,{...invoice,accountId:'account-b'},'100'),/ALLOCATION_SCOPE_MISMATCH/);
 for(const status of ['DISPUTED','VOID'] as const)assert.throws(()=>planVerifiedAllocation(payment,{...invoice,status},'100'),/INVOICE_NOT_ALLOCATABLE/);
 assert.throws(()=>planVerifiedAllocation(payment,invoice,'10001'),/INVALID_ALLOCATION_AMOUNT/);
 assert.throws(()=>planVerifiedAllocation({...payment,availableMinor:'15001'},invoice,'100'),/INCONSISTENT_BALANCE/);
});
