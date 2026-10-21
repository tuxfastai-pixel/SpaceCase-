import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {mutateBilling,readBilling} from "../../domains/billing/service";
import {founderInsights} from "../../domains/support/insights";
test("billing is private, idempotent and preserves payment corrections without service enforcement",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const schoolId=randomUUID(),personId=randomUUID();const founder={personId,founder:true,schools:[]};
 const invoice={action:"RECORD_INVOICE" as const,id:randomUUID(),schoolId,reference:"CI-"+randomUUID(),amountCents:10000,dueDate:"2026-10-20",reason:"Agreed invoice for integration verification"};
 try{
 await assert.rejects(mutateBilling(pool,{...founder,founder:false},invoice),/FOUNDER_REQUIRED/);
 await Promise.all([mutateBilling(pool,founder,invoice),mutateBilling(pool,founder,invoice)]);
 await assert.rejects(mutateBilling(pool,founder,{...invoice,amountCents:100}),/BILLING_REQUEST_CHANGED/);
 assert.equal((await readBilling(pool,founder,schoolId)).summary.invoiceCount,1);
 const receipt={action:"RECORD_RECEIPT" as const,id:randomUUID(),invoiceId:invoice.id,reference:"CI-PAY-"+randomUUID(),amountCents:6000,paidOn:"2020-01-01",verified:true as const,reason:"Independently reconciled payment"};
 await Promise.all([mutateBilling(pool,founder,receipt),mutateBilling(pool,founder,receipt)]);
 await assert.rejects(mutateBilling(pool,founder,{...receipt,id:randomUUID(),reference:"CI-"+randomUUID(),amountCents:6000}),/PAYMENT_EXCEEDS_BALANCE/);
 await assert.rejects(mutateBilling(pool,founder,{action:"VOID_INVOICE",invoiceId:invoice.id,reason:"Invalid invoice correction"}),/REVERSE_PAYMENTS_FIRST/);
 const future={...receipt,id:randomUUID(),reference:"CI-FUT-"+randomUUID(),paidOn:"2999-01-01",amountCents:1};await assert.rejects(mutateBilling(pool,founder,future),/FUTURE_PAYMENT/);
 const before=await readBilling(pool,founder,schoolId);assert.equal(before.summary.outstandingCents,"4000");assert.equal(before.enforcementEnabled,false);
 await mutateBilling(pool,founder,{action:"SET_DISPUTE",invoiceId:invoice.id,disputed:true,reason:"School disputes the recorded invoice"});
 assert.equal((await readBilling(pool,founder,schoolId)).invoices[0].status,"DISPUTED");
 await mutateBilling(pool,founder,{action:"REVERSE_RECEIPT",invoiceId:invoice.id,receiptId:receipt.id,reason:"Payment was incorrectly allocated"});
 assert.equal((await readBilling(pool,founder,schoolId)).summary.outstandingCents,"10000");
 await mutateBilling(pool,founder,{action:"VOID_INVOICE",invoiceId:invoice.id,reason:"Invoice entered incorrectly"});
 const after=await readBilling(pool,founder,schoolId);assert.equal(after.summary.outstandingCents,"0");assert.equal(after.invoices[0].status,"VOID");assert.equal(after.receipts[0].reversed,true);
 const concurrentInvoice={...invoice,id:randomUUID(),reference:"CI-CON-"+randomUUID()};await mutateBilling(pool,founder,concurrentInvoice);
 const concurrent=await Promise.allSettled([1,2].map(n=>mutateBilling(pool,founder,{...receipt,id:randomUUID(),invoiceId:concurrentInvoice.id,reference:"CI-CON-PAY-"+n+"-"+randomUUID(),amountCents:6000})));
 assert.equal(concurrent.filter(r=>r.status==="fulfilled").length,1);assert.equal(concurrent.filter(r=>r.status==="rejected").length,1);
 const concurrentBalance=await pool.query("SELECT sum(amount_cents)::int AS paid FROM billing.receipts WHERE invoice_id=$1 AND NOT reversed",[concurrentInvoice.id]);assert.equal(concurrentBalance.rows[0].paid,6000);
 assert.equal((await readBilling(pool,founder,randomUUID())).summary.invoiceCount,0);
 await assert.rejects(founderInsights(pool,{...founder,founder:false}),/FOUNDER_REQUIRED/);
 const insights=await founderInsights(pool,founder);assert.ok(insights.patternMinimumSchools>=5);assert.equal(insights.automatedRecommendations,false);assert.equal(JSON.stringify(insights).includes(receipt.reference),false);
 }finally{
 await pool.query("DELETE FROM billing.receipts WHERE invoice_id IN (SELECT id FROM billing.invoices WHERE school_id=$1)",[schoolId]);await pool.query("DELETE FROM billing.invoices WHERE school_id=$1",[schoolId]);await pool.query("DELETE FROM audit.product_audit_events WHERE actor_person_id=$1",[personId]);await pool.end();
 }
});
