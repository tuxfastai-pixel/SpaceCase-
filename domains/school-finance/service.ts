import {randomUUID} from 'node:crypto';import type {Pool,PoolClient} from 'pg';
import {financeCommand,invoiceLine,FinanceError,assertFinanceContext,assertPrincipalApproval,type FinanceCommand,type FinanceContext,type FinanceMutationResult} from './contracts';import {invoiceTotal,minorUnits,planVerifiedAllocation} from './money';import {schoolDate} from '../attendance/contracts';
async function transaction<T>(pool:Pool,c:FinanceContext,run:(db:PoolClient,timezone:string)=>Promise<T>,snapshot=false){assertFinanceContext(c,c.schoolId);const db=await pool.connect();try{await db.query(snapshot?'BEGIN ISOLATION LEVEL REPEATABLE READ':'BEGIN');await db.query("SELECT set_config('spacecase.finance_school',$1,true)",[c.schoolId]);const workspace=await db.query("SELECT timezone FROM school_ops.school_workspaces WHERE peos_school_id=$1 AND status='ACTIVE'",[c.schoolId]);if(!workspace.rows[0]?.timezone)throw new FinanceError('FINANCE_WORKSPACE_NOT_READY',409);const result=await run(db,workspace.rows[0].timezone);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
async function audit(db:PoolClient,c:FinanceContext,accountId:string|null,action:string,resourceId:string|null,reason=''){await db.query('INSERT INTO school_finance.events(id,school_id,account_id,actor_person_id,action,resource_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),c.schoolId,accountId,c.personId,action,resourceId,reason]);}
async function account(db:PoolClient,c:FinanceContext,id:string){const r=await db.query('SELECT id,learner_person_id FROM school_finance.accounts WHERE school_id=$1 AND id=$2',[c.schoolId,id]);if(!r.rowCount)throw new FinanceError('FINANCE_ACCOUNT_UNAVAILABLE',404);return r.rows[0];}
const invoiceProjection=`id,reference,status,total_minor::text AS "totalMinor",due_date::text AS "dueDate",lines,revision,created_by AS "createdBy",issued_by AS "issuedBy",created_at AS "createdAt"`;
const paymentProjection=`id,reference,status,amount_minor::text AS "amountMinor",received_on::text AS "receivedOn",method,revision,recorded_by AS "recordedBy",reviewed_by AS "reviewedBy",review_reason AS "reviewReason",created_at AS "createdAt"`;
export async function readFinance(pool:Pool,c:FinanceContext,accountId?:string,offset=0){return transaction(pool,c,async db=>{
 if(accountId)await account(db,c,accountId);
 const accounts=await db.query('SELECT id,learner_reference_snapshot AS "learnerReference",created_at AS "createdAt" FROM school_finance.accounts WHERE school_id=$1 ORDER BY created_at DESC,id LIMIT 51 OFFSET $2',[c.schoolId,offset]);
 const totals=await db.query(`SELECT (SELECT count(*)::text FROM school_finance.accounts WHERE school_id=$1) AS "accountCount",COALESCE(sum(total_minor) FILTER(WHERE status IN ('ISSUED','DISPUTED')),0)::text AS "invoicedMinor",(COALESCE(sum(total_minor) FILTER(WHERE status IN ('ISSUED','DISPUTED')),0)-(SELECT COALESCE(sum(amount_minor),0) FROM school_finance.allocations WHERE school_id=$1))::text AS "outstandingMinor",count(*) FILTER(WHERE status='DRAFT')::text AS "draftCount" FROM school_finance.invoices WHERE school_id=$1`,[c.schoolId]);
 let ledger=null;
 if(accountId){
  const invoices=await db.query(`SELECT ${invoiceProjection},(SELECT COALESCE(sum(a.amount_minor),0)::text FROM school_finance.allocations a WHERE a.school_id=$1 AND a.invoice_id=i.id) AS "allocatedMinor" FROM school_finance.invoices i WHERE school_id=$1 AND account_id=$2 ORDER BY created_at DESC,id DESC LIMIT 101`,[c.schoolId,accountId]);
  const payments=await db.query(`SELECT ${paymentProjection},(SELECT COALESCE(sum(a.amount_minor),0)::text FROM school_finance.allocations a WHERE a.school_id=$1 AND a.payment_id=p.id) AS "allocatedMinor" FROM school_finance.payments p WHERE school_id=$1 AND account_id=$2 ORDER BY created_at DESC,id DESC LIMIT 101`,[c.schoolId,accountId]);
  const balances=await db.query(`SELECT (SELECT COALESCE(sum(total_minor),0) FROM school_finance.invoices WHERE school_id=$1 AND account_id=$2 AND status IN ('ISSUED','DISPUTED'))::text AS "invoicedMinor",(SELECT COALESCE(sum(amount_minor),0) FROM school_finance.allocations WHERE school_id=$1 AND account_id=$2)::text AS "allocatedMinor",((SELECT COALESCE(sum(amount_minor),0) FROM school_finance.payments WHERE school_id=$1 AND account_id=$2 AND status='VERIFIED')-(SELECT COALESCE(sum(amount_minor),0) FROM school_finance.allocations WHERE school_id=$1 AND account_id=$2))::text AS "unallocatedVerifiedMinor"`,[c.schoolId,accountId]);
  ledger={accountId,invoices:invoices.rows.slice(0,100),invoicesTruncated:invoices.rows.length>100,payments:payments.rows.slice(0,100),paymentsTruncated:payments.rows.length>100,balances:balances.rows[0]};
 }
 await audit(db,c,accountId??null,'READ_LEDGER',accountId??null);
 return {accounts:accounts.rows.slice(0,50),nextOffset:accounts.rows.length>50?offset+50:null,summary:totals.rows[0],ledger,currency:'ZAR' as const,collectionEnabled:false,taxInvoiceEnabled:false,asOf:new Date().toISOString()};
},true);}
export async function mutateFinance(pool:Pool,c:FinanceContext,value:unknown):Promise<FinanceMutationResult>{const input=financeCommand.parse(value);return transaction(pool,c,async(db,timezone)=>{
 if(input.action==='CREATE_ACCOUNT'){
  if(!c.learner||c.learner.personId!==input.learnerPersonId)throw new FinanceError('FINANCE_LEARNER_REQUIRED');
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['finance-account:'+c.schoolId+':'+input.learnerPersonId]);
  const prior=await db.query('SELECT id FROM school_finance.accounts WHERE school_id=$1 AND learner_person_id=$2',[c.schoolId,input.learnerPersonId]);if(prior.rowCount)return {accountId:prior.rows[0].id,reused:true};
  const id=randomUUID();await db.query('INSERT INTO school_finance.accounts(id,school_id,learner_person_id,learner_reference_snapshot,created_by) VALUES($1,$2,$3,$4,$5)',[id,c.schoolId,input.learnerPersonId,c.learner.admissionNumber,c.personId]);await audit(db,c,id,input.action,id);return {accountId:id,reused:false};
 }
 if(input.action==='CREATE_INVOICE'||input.action==='REPORT_PAYMENT'||input.action==='ALLOCATE_PAYMENT'){
  await account(db,c,input.accountId);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['finance',c.schoolId,c.personId,input.action,input.requestKey])]);
 }
 if(input.action==='CREATE_INVOICE')return createInvoice(db,c,input);
 if(input.action==='REPORT_PAYMENT')return reportPayment(db,c,input,timezone);
 if(input.action==='ALLOCATE_PAYMENT')return allocate(db,c,input);
 assertPrincipalApproval(c);
 if(input.action==='VERIFY_PAYMENT'||input.action==='REJECT_PAYMENT'){
  const r=await db.query('SELECT * FROM school_finance.payments WHERE school_id=$1 AND id=$2 FOR UPDATE',[c.schoolId,input.paymentId]);const p=r.rows[0];if(!p)throw new FinanceError('FINANCE_PAYMENT_UNAVAILABLE',404);if(p.revision!==input.revision||p.status!=='REPORTED')throw new FinanceError('FINANCE_RECORD_CHANGED',409);
  if(input.action==='VERIFY_PAYMENT'&&p.recorded_by===c.personId)throw new FinanceError('FINANCE_INDEPENDENT_APPROVAL_REQUIRED');
  await db.query("UPDATE school_finance.payments SET status=$3,reviewed_by=$4,reviewed_at=clock_timestamp(),review_reason=$5,revision=revision+1 WHERE school_id=$1 AND id=$2",[c.schoolId,p.id,input.action==='VERIFY_PAYMENT'?'VERIFIED':'REJECTED',c.personId,input.reason]);await audit(db,c,p.account_id,input.action,p.id,input.reason);return {paymentId:p.id};
 }
 const r=await db.query('SELECT * FROM school_finance.invoices WHERE school_id=$1 AND id=$2 FOR UPDATE',[c.schoolId,input.invoiceId]);const i=r.rows[0];if(!i)throw new FinanceError('FINANCE_INVOICE_UNAVAILABLE',404);if(i.revision!==input.revision)throw new FinanceError('FINANCE_RECORD_CHANGED',409);
 if(input.action==='ISSUE_INVOICE'){
  if(i.status!=='DRAFT')throw new FinanceError('FINANCE_RECORD_CHANGED',409);if(i.created_by===c.personId)throw new FinanceError('FINANCE_INDEPENDENT_APPROVAL_REQUIRED');
  await db.query("UPDATE school_finance.invoices SET status='ISSUED',issued_by=$3,issued_at=clock_timestamp(),revision=revision+1 WHERE school_id=$1 AND id=$2",[c.schoolId,i.id,c.personId]);
 }else if(input.action==='VOID_INVOICE'){
  const allocations=await db.query('SELECT 1 FROM school_finance.allocations WHERE school_id=$1 AND invoice_id=$2 LIMIT 1',[c.schoolId,i.id]);if(i.status==='VOID'||allocations.rowCount)throw new FinanceError('FINANCE_VOID_UNAVAILABLE',409);
  await db.query("UPDATE school_finance.invoices SET status='VOID',voided_by=$3,void_reason=$4,revision=revision+1 WHERE school_id=$1 AND id=$2",[c.schoolId,i.id,c.personId,input.reason]);
 }else{
  if((input.action==='DISPUTE_INVOICE'&&i.status!=='ISSUED')||(input.action==='RESOLVE_DISPUTE'&&i.status!=='DISPUTED'))throw new FinanceError('FINANCE_RECORD_CHANGED',409);
  await db.query('UPDATE school_finance.invoices SET status=$3,revision=revision+1 WHERE school_id=$1 AND id=$2',[c.schoolId,i.id,input.action==='DISPUTE_INVOICE'?'DISPUTED':'ISSUED']);
 }
 await audit(db,c,i.account_id,input.action,i.id,input.reason);return {invoiceId:i.id};
});}
async function createInvoice(db:PoolClient,c:FinanceContext,input:Extract<FinanceCommand,{action:'CREATE_INVOICE'}>){
 const existing=await db.query('SELECT id,account_id,due_date::text,lines FROM school_finance.invoices WHERE school_id=$1 AND created_by=$2 AND request_key=$3',[c.schoolId,c.personId,input.requestKey]);
 if(existing.rowCount){const e=existing.rows[0];const normalized=invoiceLine.array().parse(e.lines);if(e.account_id!==input.accountId||e.due_date!==input.dueDate||JSON.stringify(normalized)!==JSON.stringify(input.lines))throw new FinanceError('FINANCE_REQUEST_CHANGED',409);return {invoiceId:e.id,reused:true};}
 const total=invoiceTotal(input.lines);const counter=await db.query('INSERT INTO school_finance.counters(school_id,next_invoice) VALUES($1,1) ON CONFLICT(school_id) DO UPDATE SET next_invoice=school_finance.counters.next_invoice+1 RETURNING next_invoice::text',[c.schoolId]);const reference='SCF-'+counter.rows[0].next_invoice.padStart(6,'0'),id=randomUUID();
 await db.query('INSERT INTO school_finance.invoices(id,school_id,account_id,request_key,reference,lines,total_minor,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)',[id,c.schoolId,input.accountId,input.requestKey,reference,JSON.stringify(input.lines),total,input.dueDate,c.personId]);await audit(db,c,input.accountId,input.action,id);return {invoiceId:id,reused:false};
}
async function reportPayment(db:PoolClient,c:FinanceContext,input:Extract<FinanceCommand,{action:'REPORT_PAYMENT'}>,timezone:string){
 const prior=await db.query('SELECT id,account_id,reference,amount_minor::text,received_on::text,method FROM school_finance.payments WHERE school_id=$1 AND recorded_by=$2 AND request_key=$3',[c.schoolId,c.personId,input.requestKey]);if(prior.rowCount){const e=prior.rows[0];if(e.account_id!==input.accountId||e.reference!==input.reference||e.amount_minor!==input.amountMinor||e.received_on!==input.receivedOn||e.method!==input.method)throw new FinanceError('FINANCE_REQUEST_CHANGED',409);return {paymentId:e.id,reused:true};}
 if(input.receivedOn>schoolDate(timezone))throw new FinanceError('FINANCE_FUTURE_PAYMENT',400);
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['finance-reference',c.schoolId,input.reference.toLowerCase()])]);const duplicate=await db.query("SELECT id FROM school_finance.payments WHERE school_id=$1 AND lower(reference)=lower($2) AND status<>'REJECTED'",[c.schoolId,input.reference]);if(duplicate.rowCount)throw new FinanceError('FINANCE_PAYMENT_REFERENCE_EXISTS',409);
 const id=randomUUID();await db.query('INSERT INTO school_finance.payments(id,school_id,account_id,request_key,reference,amount_minor,received_on,method,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,c.schoolId,input.accountId,input.requestKey,input.reference,input.amountMinor,input.receivedOn,input.method,c.personId]);await audit(db,c,input.accountId,input.action,id);return {paymentId:id,reused:false};
}
async function allocate(db:PoolClient,c:FinanceContext,input:Extract<FinanceCommand,{action:'ALLOCATE_PAYMENT'}>){
 const prior=await db.query('SELECT id,account_id,payment_id,invoice_id,amount_minor::text FROM school_finance.allocations WHERE school_id=$1 AND created_by=$2 AND request_key=$3',[c.schoolId,c.personId,input.requestKey]);if(prior.rowCount){const e=prior.rows[0];if(e.account_id!==input.accountId||e.payment_id!==input.paymentId||e.invoice_id!==input.invoiceId||e.amount_minor!==input.amountMinor)throw new FinanceError('FINANCE_REQUEST_CHANGED',409);return {allocationId:e.id,reused:true};}
 const p=(await db.query('SELECT * FROM school_finance.payments WHERE school_id=$1 AND account_id=$2 AND id=$3 FOR UPDATE',[c.schoolId,input.accountId,input.paymentId])).rows[0];if(!p)throw new FinanceError('FINANCE_PAYMENT_UNAVAILABLE',404);
 const i=(await db.query('SELECT * FROM school_finance.invoices WHERE school_id=$1 AND account_id=$2 AND id=$3 FOR UPDATE',[c.schoolId,input.accountId,input.invoiceId])).rows[0];if(!i)throw new FinanceError('FINANCE_INVOICE_UNAVAILABLE',404);
 const used=(await db.query('SELECT (SELECT COALESCE(sum(amount_minor),0) FROM school_finance.allocations WHERE school_id=$1 AND payment_id=$2)::text AS payment,(SELECT COALESCE(sum(amount_minor),0) FROM school_finance.allocations WHERE school_id=$1 AND invoice_id=$3)::text AS invoice',[c.schoolId,p.id,i.id])).rows[0];
 planVerifiedAllocation({schoolId:c.schoolId,accountId:p.account_id,currency:p.currency,verification:p.status,amountMinor:p.amount_minor,availableMinor:(minorUnits(p.amount_minor)-BigInt(used.payment)).toString()},{schoolId:c.schoolId,accountId:i.account_id,currency:i.currency,status:i.status,totalMinor:i.total_minor,outstandingMinor:(minorUnits(i.total_minor)-BigInt(used.invoice)).toString()},input.amountMinor);
 const id=randomUUID();await db.query('INSERT INTO school_finance.allocations(id,school_id,account_id,payment_id,invoice_id,request_key,amount_minor,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,c.schoolId,input.accountId,p.id,i.id,input.requestKey,input.amountMinor,c.personId]);await audit(db,c,input.accountId,input.action,id);return {allocationId:id,reused:false};
}
