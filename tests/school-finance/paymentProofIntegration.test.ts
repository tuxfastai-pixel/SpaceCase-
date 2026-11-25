import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {initializeFinance,type FinanceAuthority} from '../../domains/school-finance/workspaceService';
import {submitPaymentProof,paymentProofStatus,purgeExpiredPaymentProofFiles} from '../../domains/school-finance/paymentProofService';
import type {FamilyBillingDecision} from '../../platform/family/billingContracts';
import type {ProofSubmission} from '../../domains/school-finance/proofContracts';
test('private proof quarantine scopes retries, denies raw runtime reads, purges expired bytes and leaves the ledger unchanged',{timeout:60000},async t=>{
 if(!process.env.DATABASE_URL){t.skip('Requires isolated PostgreSQL');return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:6}),schoolId=randomUUID(),principal=randomUUID(),parent=randomUUID(),learner=randomUUID(),grantId=randomUUID();let accountId='';
 const authority:FinanceAuthority=async school=>({schoolId:school,personId:principal});
 const authorize=async():Promise<FamilyBillingDecision>=>({allowed:true,contractVersion:'family-billing-v1',grantId,personId:parent,schoolId,learnerPersonId:learner,action:'family.finance.proof.submit',expiresAt:new Date(Date.now()+30000).toISOString()});
 const bytes=Buffer.from([137,80,78,71,13,10,26,10,1]); // Synthetic signature fixture; never released or rendered.
 const policy={version:'synthetic-only-v1',hours:24,requestsPerPersonDay:20,accountBytesPerDay:2097152};
 const input:ProofSubmission={requestId:randomUUID(),mimeType:'image/png',claim:{amountMinor:'35000',paidOn:'2020-01-01',reference:'SYNTHETIC-ONLY',method:'EFT'}};
 const submit=(value=input,auth=authorize,file=bytes)=>submitPaymentProof(pool,grantId,value,file,policy,auth);
 try{
  await pool.query('INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)',[schoolId]);accountId=(await initializeFinance(pool,schoolId,principal,authority)).accountId;
  await assert.rejects(submit(input,async()=>({...await authorize(),action:'family.finance.read'})),/FAMILY_BILLING_FORBIDDEN/);
  await assert.rejects(submit(input,async()=>({...await authorize(),expiresAt:new Date(0).toISOString()})),/FAMILY_BILLING_FORBIDDEN/);
  await assert.rejects(submit({...input,claim:{...input.claim,paidOn:'2200-01-01'}}),/PROOF_FUTURE_DATE/);
  let calls=0;await assert.rejects(submit(input,async()=>{if(++calls>1)throw Error('revoked during submit');return authorize();}),/revoked during submit/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.payment_proof_cases WHERE account_id=$1',[accountId])).rows[0].n,0);
  const [first,retry]=await Promise.all([submit(),submit()]);assert.deepEqual(first,retry);assert.equal(first.status,'QUARANTINED');
  const duplicateKey={...input,requestId:randomUUID()};assert.deepEqual(await submit(duplicateKey),first);
  for(const requestId of [input.requestId,duplicateKey.requestId])assert.deepEqual(await paymentProofStatus(pool,grantId,requestId,authorize),{found:true,proof:first});
  await assert.rejects(submit({...input,claim:{...input.claim,amountMinor:'100'}}),/PROOF_REQUEST_CONFLICT/);
  await assert.rejects(submit(input,authorize,Buffer.from([...bytes,2])),/PROOF_REQUEST_CONFLICT/);
  await assert.rejects(submit({...input,requestId:randomUUID(),claim:{...input.claim,amountMinor:'100'}}),/PROOF_DUPLICATE_DETAILS_CHANGED/);
  const anotherParentId=randomUUID(),anotherParent=async():Promise<FamilyBillingDecision>=>({...await authorize(),personId:anotherParentId});assert.deepEqual(await paymentProofStatus(pool,grantId,input.requestId,anotherParent),{found:false});
  const anotherLearner=randomUUID();assert.deepEqual(await paymentProofStatus(pool,grantId,input.requestId,async()=>({...await authorize(),learnerPersonId:anotherLearner})),{found:false});
  await assert.rejects(paymentProofStatus(pool,grantId,input.requestId,async()=>({...await authorize(),schoolId:randomUUID()})),/FAMILY_ACCOUNT_UNAVAILABLE/);
  let reads=0;await assert.rejects(paymentProofStatus(pool,grantId,input.requestId,async()=>{if(++reads>1)throw Error('read revoked');return authorize();}),/read revoked/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.payment_proof_cases WHERE account_id=$1',[accountId])).rows[0].n,1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.payment_proof_quarantine WHERE account_id=$1',[accountId])).rows[0].n,1);
  const metadata=JSON.stringify(first);for(const hidden of ['file_hash','grant_id','actor_person_id','learner_person_id','digest','mime_type','body'])assert.equal(metadata.includes(hidden),false);
  const audit=(await pool.query("SELECT metadata FROM school_finance.audit_events WHERE account_id=$1 AND resource_type='PAYMENT_PROOF'",[accountId])).rows;assert.ok(audit.length>0);assert.ok(audit.every(r=>JSON.stringify(r.metadata)==='{}'));
  // Quotas are account-locked; exact same-key replay remains available after reaching a limit.
  const tight={...policy,requestsPerPersonDay:2};await assert.rejects(submitPaymentProof(pool,grantId,{...input,requestId:randomUUID()},Buffer.from([...bytes,2]),tight,authorize),/PROOF_DAILY_LIMIT/);
  assert.deepEqual(await submit(),first);
  // The restricted web role may insert bytes, but can never retrieve or delete them.
  const runtime=await pool.connect();try{
   await runtime.query('SET ROLE spacecase_runtime');
   const rights=(await runtime.query("SELECT has_table_privilege(current_user,'school_finance.payment_proof_quarantine','SELECT') AS read,has_table_privilege(current_user,'school_finance.payment_proof_quarantine','DELETE') AS deletion,has_table_privilege(current_user,'school_finance.payment_proof_cases','UPDATE') AS overwrite,has_table_privilege(current_user,'school_finance.payment_proof_cases','DELETE') AS erase")).rows[0];assert.deepEqual(rights,{read:false,deletion:false,overwrite:false,erase:false});
   const db={connect:async()=>({query:(sql:string,args?:unknown[])=>runtime.query(sql,args),release:()=>{}})} as unknown as Pool;
   assert.deepEqual(await submitPaymentProof(db,grantId,input,bytes,policy,authorize),first);
   const next={...input,requestId:randomUUID(),claim:{...input.claim,reference:'SYNTHETIC-SECOND'}};const second=await submitPaymentProof(db,grantId,next,Buffer.from([...bytes,3]),policy,authorize);assert.equal(second.status,'QUARANTINED');
   await assert.rejects(runtime.query('SELECT body FROM school_finance.payment_proof_quarantine WHERE proof_id=$1',[first.id]),/permission denied/);
   await assert.rejects(purgeExpiredPaymentProofFiles(db),/permission denied/);
  }finally{await runtime.query('RESET ROLE');runtime.release();}
  // Two different requests competing for the final allowed slot cannot both win.
  const finalSlot={...policy,requestsPerPersonDay:4};const attempts=await Promise.allSettled([4,5].map(n=>submitPaymentProof(pool,grantId,{...input,requestId:randomUUID(),claim:{...input.claim,reference:`SYNTHETIC-CONCURRENT-${n}`}},Buffer.from([...bytes,n]),finalSlot,authorize)));assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.ok(attempts.some(r=>r.status==='rejected'&&String(r.reason).includes('PROOF_DAILY_LIMIT')));
  // Simulate time passing with the test owner; normal runtime cannot rewrite these dates.
  await pool.query("UPDATE school_finance.payment_proof_cases SET received_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1",[first.id]);
  await pool.query("UPDATE school_finance.payment_proof_quarantine SET expires_at=now()-interval '1 day' WHERE proof_id=$1",[first.id]);
  const expired=await paymentProofStatus(pool,grantId,input.requestId,authorize);assert.ok(expired.found);if(expired.found)assert.equal(expired.proof.status,'EXPIRED');
  const cleanup=await pool.connect();try{await cleanup.query('SET ROLE spacecase_proof_cleanup');const db={connect:async()=>({query:(sql:string,args?:unknown[])=>cleanup.query(sql,args),release:()=>{}})} as unknown as Pool;
   assert.equal((await purgeExpiredPaymentProofFiles(db)).purged,1);assert.equal((await purgeExpiredPaymentProofFiles(db)).purged,0);
   await assert.rejects(cleanup.query('SELECT amount_minor FROM school_finance.payment_proof_cases'),/permission denied/);
  }finally{await cleanup.query('RESET ROLE');cleanup.release();}
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.payment_proof_quarantine WHERE proof_id=$1',[first.id])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.payment_proof_cases WHERE id=$1',[first.id])).rows[0].n,1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.payment_proof_purges WHERE proof_id=$1',[first.id])).rows[0].n,1);
  for(const table of ['invoices','payments','allocations'])assert.equal((await pool.query(`SELECT count(*)::int AS n FROM school_finance.${table} WHERE account_id=$1`,[accountId])).rows[0].n,0);
 }finally{if(accountId){for(const table of ['payment_proof_purges','payment_proof_quarantine','payment_proof_requests','payment_proof_cases','audit_events'])await pool.query(`DELETE FROM school_finance.${table} WHERE account_id=$1`,[accountId]);await pool.query('DELETE FROM school_finance.accounts WHERE id=$1',[accountId]);await pool.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[schoolId]);}await pool.end();}
});
