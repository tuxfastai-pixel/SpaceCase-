import type {Pool,PoolClient} from "pg";
import {assertFounder,SupportError,type SupportContext} from "../support/contracts";
import {invoiceState,type BillingAction} from "./contracts";
const projection=`i.id,i.school_id AS "schoolId",i.reference,i.amount_cents AS "amountCents",i.currency,
 i.due_date::text AS "dueDate",i.voided,i.disputed,i.created_at AS "createdAt",
 COALESCE((SELECT sum(r.amount_cents)::int FROM billing.receipts r WHERE r.invoice_id=i.id AND NOT r.reversed),0) AS "paidCents"`;
async function audit(db:PoolClient,c:SupportContext,schoolId:string,resourceId:string,action:string,reason:string){
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
 VALUES(gen_random_uuid(),$1,$2,'SCHOOL_BILLING',$3,$4,'ALLOW',$5,'{}'::jsonb,clock_timestamp())`,[c.personId,"billing."+action.toLowerCase(),resourceId,schoolId,reason]);
}
export async function readBilling(pool:Pool,c:SupportContext,schoolId:string,founder=true){
 if(founder)assertFounder(c);
 // Non-founder reads are permitted only by the school-admin HTTP guard, never the support staff context.
 const db=await pool.connect();
 try{
 await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
 const r=await db.query("SELECT "+projection+" FROM billing.invoices i WHERE i.school_id=$1 ORDER BY i.created_at DESC,i.id DESC LIMIT 101",[schoolId]);
 const totals=await db.query(`SELECT count(*)::int AS "invoiceCount",
 COALESCE(sum(amount_cents) FILTER(WHERE NOT voided),0)::text AS "invoicedCents",
 COALESCE(sum(CASE WHEN NOT voided THEN amount_cents-paid ELSE 0 END),0)::text AS "outstandingCents",
 count(*) FILTER(WHERE NOT voided AND NOT disputed AND due_date<(clock_timestamp() AT TIME ZONE 'Africa/Johannesburg')::date AND paid<amount_cents)::int AS "overdueInvoices",
 count(*) FILTER(WHERE NOT voided AND disputed)::int AS "disputedInvoices"
 FROM (SELECT i.*,COALESCE((SELECT sum(r.amount_cents) FROM billing.receipts r WHERE r.invoice_id=i.id AND NOT r.reversed),0) AS paid FROM billing.invoices i WHERE school_id=$1) s`,[schoolId]);
 const receipts=await db.query(`SELECT r.id,r.invoice_id AS "invoiceId",r.amount_cents AS "amountCents",r.reference,r.paid_on::text AS "paidOn",r.reversed FROM billing.receipts r JOIN billing.invoices i ON i.id=r.invoice_id WHERE i.school_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 101`,[schoolId]);
 const todayResult=await db.query("SELECT (clock_timestamp() AT TIME ZONE 'Africa/Johannesburg')::date::text AS today");
 await audit(db,c,schoolId,schoolId,"read","current_peos_billing_authority");
 await db.query("COMMIT");
 return {invoices:r.rows.slice(0,100).map(i=>({...i,status:invoiceState(i,todayResult.rows[0].today)})),invoicesTruncated:r.rows.length>100,receipts:receipts.rows.slice(0,100),receiptsTruncated:receipts.rows.length>100,summary:totals.rows[0],enforcementEnabled:false,contractConfigured:false,currency:"ZAR",asOf:new Date().toISOString()};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
export async function mutateBilling(pool:Pool,c:SupportContext,input:BillingAction){
 assertFounder(c);const db=await pool.connect();
 try{
 await db.query("BEGIN");
 if(input.action==="RECORD_INVOICE"){
 await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["invoice:"+input.id]);
 const existing=await db.query("SELECT school_id,reference,amount_cents,due_date::text AS due_date FROM billing.invoices WHERE id=$1",[input.id]);
 if(existing.rows[0]){
 const e=existing.rows[0];if(e.school_id!==input.schoolId||e.reference!==input.reference||e.amount_cents!==input.amountCents||e.due_date!==input.dueDate)throw new SupportError("BILLING_REQUEST_CHANGED",409);
 }else{
 await db.query("INSERT INTO billing.invoices(id,school_id,reference,amount_cents,due_date,recorded_by) VALUES($1,$2,$3,$4,$5,$6)",[input.id,input.schoolId,input.reference,input.amountCents,input.dueDate,c.personId]);
 await audit(db,c,input.schoolId,input.id,input.action,input.reason);
 }
 }else{
 const locked=await db.query('SELECT id,school_id AS "schoolId",amount_cents AS "amountCents",voided,disputed FROM billing.invoices WHERE id=$1 FOR UPDATE',[input.invoiceId]);
 const invoice=locked.rows[0];if(!invoice)throw new SupportError("INVOICE_UNAVAILABLE",404);
 // Read the balance in a fresh statement after acquiring the lock: a waiting transaction must see receipts committed by the previous lock holder.
 const balance=await db.query("SELECT COALESCE(sum(amount_cents),0)::int AS paid FROM billing.receipts WHERE invoice_id=$1 AND NOT reversed",[input.invoiceId]);
 invoice.paidCents=balance.rows[0].paid;
 if(input.action==="RECORD_RECEIPT"){
 const exists=await db.query("SELECT invoice_id,reference,amount_cents,paid_on::text AS paid_on FROM billing.receipts WHERE id=$1",[input.id]);
 if(exists.rows[0]){
 const e=exists.rows[0];if(e.invoice_id!==input.invoiceId||e.reference!==input.reference||e.amount_cents!==input.amountCents||e.paid_on!==input.paidOn)throw new SupportError("BILLING_REQUEST_CHANGED",409);
 }else{
 if(invoice.voided)throw new SupportError("INVOICE_VOID",409);
 const today=await db.query("SELECT (clock_timestamp() AT TIME ZONE 'Africa/Johannesburg')::date::text AS today");
 if(input.paidOn>today.rows[0].today)throw new SupportError("FUTURE_PAYMENT",400);
 if(invoice.paidCents+input.amountCents>invoice.amountCents)throw new SupportError("PAYMENT_EXCEEDS_BALANCE",409);
 await db.query("INSERT INTO billing.receipts(id,invoice_id,amount_cents,reference,paid_on,verified_by) VALUES($1,$2,$3,$4,$5,$6)",[input.id,input.invoiceId,input.amountCents,input.reference,input.paidOn,c.personId]);
 await audit(db,c,invoice.schoolId,input.id,input.action,input.reason);
 }
 }else if(input.action==="VOID_INVOICE"){
 if(invoice.paidCents>0)throw new SupportError("REVERSE_PAYMENTS_FIRST",409);
 if(!invoice.voided){await db.query("UPDATE billing.invoices SET voided=true WHERE id=$1",[input.invoiceId]);await audit(db,c,invoice.schoolId,input.invoiceId,input.action,input.reason);}
 }else if(input.action==="SET_DISPUTE"){
 if(invoice.voided)throw new SupportError("INVOICE_VOID",409);
 if(invoice.disputed!==input.disputed){await db.query("UPDATE billing.invoices SET disputed=$2 WHERE id=$1",[input.invoiceId,input.disputed]);await audit(db,c,invoice.schoolId,input.invoiceId,input.action,input.reason);}
 }else{
 const receipt=await db.query("SELECT id,reversed FROM billing.receipts WHERE id=$1 AND invoice_id=$2 FOR UPDATE",[input.receiptId,input.invoiceId]);
 if(!receipt.rows[0])throw new SupportError("RECEIPT_UNAVAILABLE",404);
 if(!receipt.rows[0].reversed){await db.query("UPDATE billing.receipts SET reversed=true WHERE id=$1",[input.receiptId]);await audit(db,c,invoice.schoolId,input.receiptId,input.action,input.reason);}
 }
 }
 await db.query("COMMIT");return {recorded:true,enforcementEnabled:false};
 }catch(e){await db.query("ROLLBACK");if((e as {code?:string}).code==="23505")throw new SupportError("BILLING_REFERENCE_EXISTS",409);throw e;}finally{db.release();}
}
