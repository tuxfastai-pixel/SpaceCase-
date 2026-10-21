import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {billingAction,invoiceState} from "../../domains/billing/contracts";
test("billing needs integer cents, valid dates and explicit verification",()=>{
 const invoice={action:"RECORD_INVOICE",id:randomUUID(),schoolId:randomUUID(),reference:"INV-001",amountCents:10000,dueDate:"2026-10-20",reason:"Agreed invoice recorded"};
 assert.equal(billingAction.safeParse(invoice).success,true);
 for(const patch of [{amountCents:0},{amountCents:1.2},{dueDate:"2026-02-30"},{reference:"Bank account 123"},{action:"SUSPEND"}])assert.equal(billingAction.safeParse({...invoice,...patch}).success,false);
 const receipt={action:"RECORD_RECEIPT",id:randomUUID(),invoiceId:invoice.id,reference:"PAY-001",amountCents:10000,paidOn:"2026-10-20",verified:true,reason:"Reconciled bank receipt"};
 assert.equal(billingAction.safeParse(receipt).success,true);assert.equal(billingAction.safeParse({...receipt,verified:false}).success,false);
});
test("due dates, partial payment, disputes and voids have distinct states",()=>{
 const i={amountCents:10000,paidCents:0,dueDate:"2026-10-20",voided:false,disputed:false};
 assert.equal(invoiceState(i,"2026-10-20"),"DUE");
 assert.equal(invoiceState(i,"2026-10-21"),"OVERDUE");
 assert.equal(invoiceState({...i,paidCents:100},"2026-10-21"),"OVERDUE_PART_PAID");
 assert.equal(invoiceState({...i,paidCents:100},"2026-10-19"),"PART_PAID");
 assert.equal(invoiceState({...i,paidCents:10000},"2026-10-21"),"PAID");
 assert.equal(invoiceState({...i,disputed:true},"2026-10-21"),"DISPUTED");
 assert.equal(invoiceState({...i,voided:true,disputed:true},"2026-10-21"),"VOID");
});
