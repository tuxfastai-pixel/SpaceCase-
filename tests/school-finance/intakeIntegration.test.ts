import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {previewIntake,importIntake,actOnIntake,listIntake} from '../../domains/school-finance/intakeService';
import {initializeFinance,type FinanceAuthority} from '../../domains/school-finance/workspaceService';

test('intake serializes replay/report, isolates school scope and preserves independent review under restricted runtime',{timeout:60000},async t=>{
 if(!process.env.DATABASE_URL){t.skip('Requires isolated PostgreSQL');return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5}),schoolId=randomUUID(),actorPersonId=randomUUID();
 const authorize:FinanceAuthority=async school=>({schoolId:school,personId:actorPersonId});
 let accountId='';
 try{
  await pool.query('INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)',[schoolId]);
  accountId=(await initializeFinance(pool,schoolId,actorPersonId,authorize)).accountId;
  const scope={schoolId,accountId,actorPersonId},invoiceId=randomUUID();
  await pool.query("INSERT INTO school_finance.invoices(id,account_id,peos_learner_id,invoice_number,amount_minor,due_date,created_by_peos_person_id) VALUES($1,$2,$3,'FEE-1',10001,'2027-01-01',$4)",[invoiceId,accountId,randomUUID(),actorPersonId]);
  const upload={source:'Test Bank',delimiter:',' as const,decimalSeparator:'.' as const,mapping:{date:'Date',reference:'Reference',amount:'Amount',transactionId:'ID'},csv:'Date,Reference,Amount,ID\n2025-11-01,FEE-1,100.01,T1\n2025-11-02,Fee,-2.00,T2'};
  const preview=await previewIntake(pool,scope,upload,authorize);
  assert.equal(preview.items[0].suggestion?.invoiceId,invoiceId);assert.equal(preview.ignored,1);
  const imports=await Promise.all([importIntake(pool,scope,upload,preview.previewDigest,authorize),importIntake(pool,scope,upload,preview.previewDigest,authorize)]);
  assert.equal(imports.filter(i=>i.replayed).length,1);
  let queue=await listIntake(pool,scope,undefined,authorize);assert.equal(queue.rows.length,1);assert.equal(queue.profiles[0].mapping.reference,'Reference');
  const candidateId=queue.rows[0].id;
  const reports=await Promise.all([actOnIntake(pool,scope,{candidateId,action:'REPORT'},authorize),actOnIntake(pool,scope,{candidateId,action:'REPORT'},authorize)]);
  assert.equal(reports.filter(r=>'replayed' in r&&r.replayed).length,1);
  const payment=await pool.query("SELECT verification,recorded_by_peos_person_id,amount_minor::text FROM school_finance.payments WHERE account_id=$1",[accountId]);
  assert.equal(payment.rows.length,1);assert.deepEqual(payment.rows[0],{verification:'REPORTED',recorded_by_peos_person_id:actorPersonId,amount_minor:'10001'});
  assert.equal((await pool.query('SELECT count(*)::int n FROM school_finance.allocations WHERE account_id=$1',[accountId])).rows[0].n,0);
  const overlap={...upload,csv:'Date,Reference,Amount,ID\n2025-11-01,FEE-1,100.01,T1\n2025-11-03,FEE-1,1.00,T3'};
  const p=await previewIntake(pool,scope,overlap,authorize);assert.equal(p.items[0].status,'DUPLICATE_REVIEW');
  await importIntake(pool,scope,overlap,p.previewDigest,authorize);
  queue=await listIntake(pool,scope,undefined,authorize);const duplicate=queue.rows.find(r=>r.duplicateKind==='SOURCE_ID')!;
  await assert.rejects(actOnIntake(pool,scope,{candidateId:duplicate.id,action:'REPORT'},authorize),/REVIEW_DUPLICATE/);
  await assert.rejects(actOnIntake(pool,scope,{candidateId:duplicate.id,action:'CONFIRM_DISTINCT',reason:'Different'},authorize),/SOURCE_TRANSACTION/);
  await actOnIntake(pool,scope,{candidateId:duplicate.id,action:'DISMISS',reason:'Same transaction in overlapping statement'},authorize);
  await assert.rejects(listIntake(pool,{...scope,schoolId:randomUUID()},undefined,authorize),/FINANCE_ACCOUNT_UNAVAILABLE/);
  await assert.rejects(listIntake(pool,scope,undefined,async school=>({schoolId:school,personId:randomUUID()})),/FINANCE_FORBIDDEN/);
  await assert.rejects(listIntake(pool,scope,randomUUID(),authorize),/INVALID_CURSOR/);
  const noId={...upload,mapping:{date:'Date',reference:'Reference',amount:'Amount'},csv:'Date,Reference,Amount\n2025-11-01,FEE-1,100.01'};
  const n=await previewIntake(pool,scope,noId,authorize);assert.equal(n.items[0].duplicateKind,'FINGERPRINT');
  await importIntake(pool,scope,noId,n.previewDigest,authorize);
  queue=await listIntake(pool,scope,undefined,authorize);const possible=queue.rows.find(r=>r.duplicateKind==='FINGERPRINT')!;
  await actOnIntake(pool,scope,{candidateId:possible.id,action:'CONFIRM_DISTINCT',reason:'Test: reviewed independent transaction evidence'},authorize);
  assert.equal((await listIntake(pool,scope,undefined,authorize)).rows.find(r=>r.id===possible.id)?.status,'READY');
  // A failed audit must roll back both reported money and the queue transition.
  const functionName='intake_audit_'+randomUUID().replaceAll('-','');
  await pool.query(`CREATE FUNCTION public.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.account_id='${accountId}'::uuid AND NEW.action='FINANCE_IMPORT_ITEM_REPORTED' THEN RAISE EXCEPTION 'synthetic intake audit outage'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${functionName} BEFORE INSERT ON school_finance.audit_events FOR EACH ROW EXECUTE FUNCTION public.${functionName}()`);
  try{await assert.rejects(actOnIntake(pool,scope,{candidateId:possible.id,action:'REPORT'},authorize),/synthetic intake audit outage/);}
  finally{await pool.query(`DROP TRIGGER ${functionName} ON school_finance.audit_events`);await pool.query(`DROP FUNCTION public.${functionName}()`);}
  assert.equal((await pool.query('SELECT count(*)::int n FROM school_finance.payments WHERE account_id=$1',[accountId])).rows[0].n,1);
  assert.equal((await listIntake(pool,scope,undefined,authorize)).rows.find(r=>r.id===possible.id)?.status,'READY');
  // Import confirmation rechecks current facts instead of trusting the browser preview.
  const fresh={...upload,csv:'Date,Reference,Amount,ID\n2025-11-04,FEE-1,1.00,T4'};
  const stale=await previewIntake(pool,scope,fresh,authorize);
  await pool.query("UPDATE school_finance.invoices SET status='DISPUTED' WHERE id=$1",[invoiceId]);
  await assert.rejects(importIntake(pool,scope,fresh,stale.previewDigest,authorize),/PREVIEW_CHANGED/);
  const bulk={...upload,source:'Bulk source',csv:'Date,Reference,Amount,ID\n'+Array.from({length:500},(_,i)=>`2025-11-05,BULK-${i},1.00,BULK-${i}`).join('\n')};
  const bulkPreview=await previewIntake(pool,scope,bulk,authorize);assert.equal(bulkPreview.items.length,500);
  assert.equal((await importIntake(pool,scope,bulk,bulkPreview.previewDigest,authorize)).imported,500);
  const seen=new Set<string>();let cursor:string|undefined;
  do {const page=await listIntake(pool,scope,cursor,authorize);for(const row of page.rows){assert.ok(!seen.has(row.id));seen.add(row.id);}cursor=page.nextCursor??undefined;}while(cursor);
  assert.ok(seen.size>=500);
  if((await pool.query("SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime'")).rowCount){
   const runtime=await pool.connect();try{
    await runtime.query('SET ROLE spacecase_runtime');
    const db={connect:async()=>({query:(sql:string,args?:unknown[])=>runtime.query(sql,args),release:()=>{}})} as unknown as Pool;
    const r=await previewIntake(db,scope,fresh,authorize);await importIntake(db,scope,fresh,r.previewDigest,authorize);
    await actOnIntake(db,scope,{candidateId:possible.id,action:'REPORT'},authorize);
    const q=await listIntake(db,scope,undefined,authorize);assert.ok(q.rows.length>0);
    const rights=await runtime.query("SELECT has_column_privilege(current_user,'school_finance.import_candidates','amount_minor','UPDATE') money,has_table_privilege(current_user,'school_finance.import_candidates','DELETE') deletion,has_table_privilege(current_user,'school_finance.audit_events','UPDATE') audit_update");
    assert.deepEqual(rights.rows[0],{money:false,deletion:false,audit_update:false});
   }finally{await runtime.query('RESET ROLE');runtime.release();}
  }
  // Existing manually entered payments must also be included in duplicate review.
  await pool.query("INSERT INTO school_finance.payments(account_id,external_reference,amount_minor,recorded_by_peos_person_id) VALUES($1,'MANUAL-REF',500,$2)",[accountId,actorPersonId]);
  const manual={...upload,csv:'Date,Reference,Amount,ID\n2025-11-06,MANUAL-REF,5.00,NEW-ID\n2025-11-07,Another reference,6.00,MANUAL-REF'};
  const manualPreview=await previewIntake(pool,scope,manual,authorize);
  assert.equal(manualPreview.items[0].duplicateKind,'FINGERPRINT');
  assert.equal(manualPreview.items[1].duplicateKind,'SOURCE_ID');
 }finally{
  if(accountId){for(const table of ['import_candidates','import_batches','import_profiles','audit_events','allocations','invoice_lines','instalments','invoices','payments'])await pool.query(`DELETE FROM school_finance.${table} WHERE account_id=$1`,[accountId]);await pool.query('DELETE FROM school_finance.accounts WHERE id=$1',[accountId]);await pool.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[schoolId]);}
  await pool.end();
 }
});
