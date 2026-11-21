import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {hash,IntakeError,normalizeIntake,type IntakeUpload} from './intakeCsv';
import {financeTransaction,financeAuthority,lockFinanceAccount,financeAudit,type FinanceScope,type FinanceAuthority} from './workspaceService';

async function plan(db:PoolClient,scope:FinanceScope,upload:IntakeUpload){
 const normalized=normalizeIntake(upload);
 if(normalized.errors.length)return {...normalized,items:[],previewDigest:hash(normalized)};
 const existing=await db.query<{fingerprint:string;source_transaction_id:string|null}>(`SELECT DISTINCT fingerprint,source_transaction_id FROM school_finance.import_candidates WHERE account_id=$1 AND source_key=$2 AND (fingerprint=ANY($3::text[]) OR source_transaction_id=ANY($4::text[]))`,[scope.accountId,normalized.source,normalized.rows.map(r=>r.fingerprint),normalized.rows.flatMap(r=>r.transactionId?[r.transactionId]:[])]);
 const manualPayments=await db.query<{external_reference:string;amount_minor:string}>(`SELECT external_reference,amount_minor::text FROM school_finance.payments WHERE account_id=$1 AND (external_reference=ANY($2::text[]) OR upper(external_reference)=ANY($3::text[]))`,[scope.accountId,normalized.rows.flatMap(r=>r.transactionId?[r.transactionId]:[]),normalized.rows.map(r=>r.reference.toUpperCase())]);
 const invoices=await db.query<{id:string;reference:string;outstanding:string}>(`SELECT i.id,i.invoice_number AS reference,(i.amount_minor-COALESCE((SELECT sum(a.amount_minor) FROM school_finance.allocations a WHERE a.invoice_id=i.id AND a.account_id=i.account_id),0))::text AS outstanding FROM school_finance.invoices i WHERE i.account_id=$1 AND i.status='ISSUED' AND upper(i.invoice_number)=ANY($2::text[])`,[scope.accountId,normalized.rows.map(r=>r.reference.toUpperCase())]);
 const items=normalized.rows.map(row=>{
  const peers=normalized.rows.filter(r=>r.line!==row.line);
  const sourceDuplicate=row.transactionId&&(existing.rows.some(r=>r.source_transaction_id===row.transactionId)||peers.some(r=>r.transactionId===row.transactionId)||manualPayments.rows.some(p=>p.external_reference===row.transactionId));
  const fingerprintDuplicate=existing.rows.some(r=>r.fingerprint===row.fingerprint&&(!row.transactionId||!r.source_transaction_id))||peers.some(r=>r.fingerprint===row.fingerprint&&(!row.transactionId||!r.transactionId))||manualPayments.rows.some(p=>p.external_reference.toUpperCase()===row.reference.toUpperCase()&&p.amount_minor===row.amountMinor);
  const duplicateKind=sourceDuplicate?'SOURCE_ID':fingerprintDuplicate?'FINGERPRINT':null;
  const matches=invoices.rows.filter(i=>i.reference.toUpperCase()===row.reference.toUpperCase()&&BigInt(i.outstanding)>0n);
  const suggestion=matches.length===1?{invoiceId:matches[0].id,invoiceNumber:matches[0].reference,outstandingMinor:matches[0].outstanding,amountFits:BigInt(row.amountMinor)<=BigInt(matches[0].outstanding),reason:'Exact invoice reference; staff must confirm before allocation'}:null;
  return {...row,status:duplicateKind?'DUPLICATE_REVIEW':'READY',duplicateKind,suggestion};
 });
 return {...normalized,items,previewDigest:hash({account:scope.accountId,digest:normalized.digest,items})};
}
export async function previewIntake(pool:Pool,scope:FinanceScope,upload:IntakeUpload,authorize:FinanceAuthority){
 await financeAuthority(scope,'finance.transactions.record',authorize);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);
  const result=await plan(db,scope,upload);
  await financeAudit(db,scope,'FINANCE_IMPORT_PREVIEWED','IMPORT',randomUUID(),{received:result.received,ignored:result.ignored,invalid:result.errors.length});
  return result;
 });
}
export async function importIntake(pool:Pool,scope:FinanceScope,upload:IntakeUpload,previewDigest:string,authorize:FinanceAuthority){
 await financeAuthority(scope,'finance.transactions.record',authorize);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);
  const normalized=normalizeIntake(upload);
  if(normalized.errors.length||!normalized.rows.length)throw new IntakeError('VALID_CREDIT_ROWS_REQUIRED');
  const old=await db.query<{id:string}>('SELECT id FROM school_finance.import_batches WHERE account_id=$1 AND source_key=$2 AND digest=$3',[scope.accountId,normalized.source,normalized.digest]);
  if(old.rows[0])return {batchId:old.rows[0].id,replayed:true,imported:0};
  const result=await plan(db,scope,upload);
  if(result.previewDigest!==previewDigest)throw new IntakeError('PREVIEW_CHANGED_REVIEW_AGAIN',409);
  const id=randomUUID();
  await db.query('INSERT INTO school_finance.import_batches(id,account_id,source_key,digest,imported_by_peos_person_id,received_count,ignored_count) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,scope.accountId,result.source,result.digest,scope.actorPersonId,result.received,result.ignored]);
  await db.query(`INSERT INTO school_finance.import_candidates(account_id,batch_id,row_number,source_key,transaction_date,reference,source_transaction_id,amount_minor,fingerprint,status,duplicate_kind)
   SELECT $1,$2,r.line,$3,r.date,r.reference,r."transactionId",r."amountMinor",r.fingerprint,r.status,r."duplicateKind"
   FROM jsonb_to_recordset($4::jsonb) AS r(line integer,date date,reference text,"transactionId" text,"amountMinor" bigint,fingerprint text,status text,"duplicateKind" text)`,[scope.accountId,id,result.source,JSON.stringify(result.items)]);
  await db.query(`INSERT INTO school_finance.import_profiles(account_id,source_key,mapping,delimiter,decimal_separator,header_signature) VALUES($1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT(account_id,source_key) DO UPDATE SET mapping=EXCLUDED.mapping,delimiter=EXCLUDED.delimiter,decimal_separator=EXCLUDED.decimal_separator,header_signature=EXCLUDED.header_signature,updated_at=now()`,[scope.accountId,result.source,JSON.stringify(upload.mapping),upload.delimiter,upload.decimalSeparator,result.headerSignature]);
  await financeAudit(db,scope,'FINANCE_IMPORT_SAVED','IMPORT',id,{received:result.received,imported:result.items.length,ignored:result.ignored,duplicates:result.items.filter(r=>r.duplicateKind).length});
  return {batchId:id,replayed:false,imported:result.items.length};
 });
}
export async function actOnIntake(pool:Pool,scope:FinanceScope,input:{candidateId:string;action:'REPORT'|'DISMISS'|'CONFIRM_DISTINCT';reason?:string},authorize:FinanceAuthority){
 await financeAuthority(scope,'finance.transactions.record',authorize);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);
  const found=await db.query<{id:string;status:string;amount_minor:string;payment_id:string|null;duplicate_kind:string|null}>(`SELECT id,status,amount_minor::text,payment_id,duplicate_kind FROM school_finance.import_candidates WHERE account_id=$1 AND id=$2`,[scope.accountId,input.candidateId]);
  const row=found.rows[0];if(!row)throw new IntakeError('ITEM_NOT_FOUND',404);
  if(input.action==='REPORT'){
   if(row.status==='REPORTED')return {paymentId:row.payment_id,replayed:true};
   if(row.status!=='READY')throw new IntakeError('REVIEW_DUPLICATE_OR_DISMISSED_ITEM',409);
   const paymentId=randomUUID();
   await db.query(`INSERT INTO school_finance.payments(id,account_id,external_reference,amount_minor,verification,recorded_by_peos_person_id,method) VALUES($1,$2,$3,$4,'REPORTED',$5,'OTHER')`,[paymentId,scope.accountId,`IMPORT-${row.id}`,row.amount_minor,scope.actorPersonId]);
   await db.query(`UPDATE school_finance.import_candidates SET status='REPORTED',payment_id=$3,reviewed_by_peos_person_id=$4,reviewed_at=now() WHERE account_id=$1 AND id=$2`,[scope.accountId,row.id,paymentId,scope.actorPersonId]);
   await financeAudit(db,scope,'FINANCE_PAYMENT_REPORTED','PAYMENT',paymentId,{amountMinor:row.amount_minor,intakeId:row.id});
   await financeAudit(db,scope,'FINANCE_IMPORT_ITEM_REPORTED','IMPORT_ITEM',row.id,{paymentId});
   return {paymentId,replayed:false};
  }
  if(!input.reason?.trim()||input.reason.trim().length>500||/[\u0000-\u001f\u007f]/.test(input.reason))throw new IntakeError('REVIEW_REASON_REQUIRED');
  if(row.status==='REPORTED'||row.status==='DISMISSED')throw new IntakeError('ITEM_ALREADY_PROCESSED',409);
  if(input.action==='CONFIRM_DISTINCT'&&(row.status!=='DUPLICATE_REVIEW'||row.duplicate_kind!=='FINGERPRINT'))throw new IntakeError('SOURCE_TRANSACTION_ID_MUST_BE_UNIQUE',409);
  const status=input.action==='DISMISS'?'DISMISSED':'READY';
  await db.query(`UPDATE school_finance.import_candidates SET status=$3,review_reason=$4,reviewed_by_peos_person_id=$5,reviewed_at=now() WHERE account_id=$1 AND id=$2`,[scope.accountId,row.id,status,input.reason.trim(),scope.actorPersonId]);
  await financeAudit(db,scope,`FINANCE_IMPORT_${input.action}`,'IMPORT_ITEM',row.id,{decision:status,reason:input.reason.trim()});
  return {status};
 });
}
export async function listIntake(pool:Pool,scope:FinanceScope,before:string|undefined,authorize:FinanceAuthority){
 await financeAuthority(scope,'finance.transactions.read',authorize);
 return financeTransaction(pool,async db=>{
  await lockFinanceAccount(db,scope);
  // UUID cursor resolves its own timestamp only within the current authorized account.
  if(before){const cursor=await db.query('SELECT id FROM school_finance.import_candidates WHERE id=$1 AND account_id=$2',[before,scope.accountId]);if(!cursor.rowCount)throw new IntakeError('INVALID_CURSOR');}
  const result=await db.query(`SELECT id,source_key AS source,to_char(transaction_date,'YYYY-MM-DD') AS date,reference,source_transaction_id AS "transactionId",amount_minor::text AS "amountMinor",status,duplicate_kind AS "duplicateKind",payment_id AS "paymentId",review_reason AS "reviewReason" FROM school_finance.import_candidates c WHERE account_id=$1 AND ($2::uuid IS NULL OR (c.created_at,c.id)<(SELECT created_at,id FROM school_finance.import_candidates WHERE id=$2 AND account_id=$1)) ORDER BY c.created_at DESC,c.id DESC LIMIT 51`,[scope.accountId,before??null]);
  const profiles=await db.query('SELECT source_key AS source,mapping,delimiter,decimal_separator AS "decimalSeparator",header_signature AS "headerSignature" FROM school_finance.import_profiles WHERE account_id=$1 ORDER BY updated_at DESC LIMIT 50',[scope.accountId]);
  const counts=await db.query('SELECT status,count(*)::int AS count FROM school_finance.import_candidates WHERE account_id=$1 GROUP BY status',[scope.accountId]);
  const invoices=await db.query(`SELECT c.id AS "candidateId",i.invoice_number AS "invoiceNumber",(i.amount_minor-COALESCE((SELECT sum(a.amount_minor) FROM school_finance.allocations a WHERE a.invoice_id=i.id AND a.account_id=i.account_id),0))::text AS "outstandingMinor" FROM school_finance.import_candidates c JOIN school_finance.invoices i ON i.account_id=c.account_id AND upper(i.invoice_number)=upper(c.reference) AND i.status='ISSUED' WHERE c.account_id=$1 AND c.id=ANY($2::uuid[])`,[scope.accountId,result.rows.slice(0,50).map(r=>r.id)]);
  const rows=result.rows.slice(0,50).map(row=>{const matches=invoices.rows.filter(i=>i.candidateId===row.id&&BigInt(i.outstandingMinor)>0n);return {...row,suggestion:matches.length===1?{invoiceNumber:matches[0].invoiceNumber,outstandingMinor:matches[0].outstandingMinor,amountFits:BigInt(row.amountMinor)<=BigInt(matches[0].outstandingMinor)}:null};});
  await financeAudit(db,scope,'FINANCE_IMPORT_QUEUE_READ','ACCOUNT',scope.accountId,{count:rows.length});
  return {rows,profiles:profiles.rows,counts:counts.rows,nextCursor:result.rows.length>50?rows.at(-1)?.id:null};
 });
}
