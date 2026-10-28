import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {mutateFinance,readFinance} from '../../domains/school-finance/service';import type {FinanceContext} from '../../domains/school-finance/contracts';
test('school ledger persists two-person approvals and exact allocations with RLS, idempotency and immutable history',{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const owner=new Pool({connectionString:process.env.DATABASE_URL}),runtime=new Pool({connectionString:process.env.DATABASE_URL,options:'-c role=spacecase_runtime'});
 const school=randomUUID(),otherSchool=randomUUID(),officerId=randomUUID(),principalId=randomUUID(),learnerId=randomUUID();
 const officer:FinanceContext={personId:officerId,schoolId:school,displayName:'CI school',principal:false,learner:{personId:learnerId,admissionNumber:'REF-001'}};const principal={...officer,personId:principalId,principal:true,learner:null};
 try{
  for(const id of [school,otherSchool])await owner.query("INSERT INTO school_ops.school_workspaces(peos_school_id,status,timezone) VALUES($1,'ACTIVE','Africa/Johannesburg')",[id]);
  const creates=await Promise.all([1,2].map(()=>mutateFinance(runtime,officer,{action:'CREATE_ACCOUNT',learnerPersonId:learnerId})));assert.equal(creates[0].accountId,creates[1].accountId);const accountId=creates[0].accountId;assert.ok(accountId);
  assert.equal((await runtime.query('SELECT count(*)::int AS count FROM school_finance.accounts')).rows[0].count,0);
  await assert.rejects(readFinance(runtime,{...officer,schoolId:otherSchool},accountId),/FINANCE_ACCOUNT_UNAVAILABLE/);
  await assert.rejects(mutateFinance(runtime,{...officer,learner:null},{action:'CREATE_ACCOUNT',learnerPersonId:learnerId}),/FINANCE_LEARNER_REQUIRED/);
  const invoiceInput={action:'CREATE_INVOICE',requestKey:randomUUID(),accountId,dueDate:'2100-01-01',lines:[{description:'School fees',quantity:1,unitPriceMinor:'10000'}]};
  const draft=await mutateFinance(runtime,officer,invoiceInput);assert.equal((await mutateFinance(runtime,officer,invoiceInput)).invoiceId,draft.invoiceId);
  await assert.rejects(mutateFinance(runtime,officer,{...invoiceInput,lines:[{description:'Changed',quantity:1,unitPriceMinor:'10000'}]}),/FINANCE_REQUEST_CHANGED/);
  await assert.rejects(mutateFinance(runtime,officer,{action:'ISSUE_INVOICE',invoiceId:draft.invoiceId,revision:1,reason:'Checked fee record'}),/FINANCE_PRINCIPAL_REQUIRED/);
  await assert.rejects(mutateFinance(runtime,{...officer,principal:true},{action:'ISSUE_INVOICE',invoiceId:draft.invoiceId,revision:1,reason:'Self approval'}),/FINANCE_INDEPENDENT_APPROVAL_REQUIRED/);
  await mutateFinance(runtime,principal,{action:'ISSUE_INVOICE',invoiceId:draft.invoiceId,revision:1,reason:'Checked approved fee record'});
  const report={action:'REPORT_PAYMENT',requestKey:randomUUID(),accountId,reference:'CI-'+randomUUID(),amountMinor:'15000',receivedOn:'2020-01-01',method:'EFT'};
  const payment=await mutateFinance(runtime,officer,report);assert.equal((await mutateFinance(runtime,officer,report)).paymentId,payment.paymentId);
  await assert.rejects(mutateFinance(runtime,officer,{...report,requestKey:randomUUID()}),/FINANCE_PAYMENT_REFERENCE_EXISTS/);
  const allocation={action:'ALLOCATE_PAYMENT',requestKey:randomUUID(),accountId,paymentId:payment.paymentId,invoiceId:draft.invoiceId,amountMinor:'7000'};
  await assert.rejects(mutateFinance(runtime,officer,allocation),/VERIFIED_PAYMENT_REQUIRED/);
  await assert.rejects(mutateFinance(runtime,{...officer,principal:true},{action:'VERIFY_PAYMENT',paymentId:payment.paymentId,revision:1,reason:'Self check',checkedAgainstSchoolRecords:true}),/FINANCE_INDEPENDENT_APPROVAL_REQUIRED/);
  await mutateFinance(runtime,principal,{action:'VERIFY_PAYMENT',paymentId:payment.paymentId,revision:1,reason:'Reconciled against school records',checkedAgainstSchoolRecords:true});
  await mutateFinance(runtime,principal,{action:'DISPUTE_INVOICE',invoiceId:draft.invoiceId,revision:2,reason:'Requested fee review'});
  await assert.rejects(mutateFinance(runtime,officer,allocation),/INVOICE_NOT_ALLOCATABLE/);
  await mutateFinance(runtime,principal,{action:'RESOLVE_DISPUTE',invoiceId:draft.invoiceId,revision:3,reason:'Reviewed agreed fee record'});
  const competing=[allocation,{...allocation,requestKey:randomUUID()}];const results=await Promise.allSettled(competing.map(a=>mutateFinance(runtime,officer,a)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const winner=results.findIndex(r=>r.status==='fulfilled');assert.equal((await mutateFinance(runtime,officer,competing[winner])).reused,true);
  await mutateFinance(runtime,officer,{...allocation,requestKey:randomUUID(),amountMinor:'3000'});
  const ledger=await readFinance(runtime,principal,accountId);assert.equal(ledger.summary.outstandingMinor,'0');assert.equal(ledger.ledger?.balances.allocatedMinor,'10000');assert.equal(ledger.ledger?.balances.unallocatedVerifiedMinor,'5000');
  await assert.rejects(mutateFinance(runtime,principal,{action:'VOID_INVOICE',invoiceId:draft.invoiceId,revision:4,reason:'Cannot erase paid invoice'}),/FINANCE_VOID_UNAVAILABLE/);
  const privileges=await owner.query("SELECT has_column_privilege('spacecase_runtime','school_finance.invoices','total_minor','UPDATE') AS edit_total,has_column_privilege('spacecase_runtime','school_finance.payments','amount_minor','UPDATE') AS edit_payment,has_table_privilege('spacecase_runtime','school_finance.allocations','DELETE') AS delete_allocation");assert.deepEqual(privileges.rows[0],{edit_total:false,edit_payment:false,delete_allocation:false});
  const failReason='audit-rollback-'+randomUUID();const constraint='ci_finance_'+randomUUID().replaceAll('-','');
  await owner.query(`ALTER TABLE school_finance.events ADD CONSTRAINT ${constraint} CHECK(actor_person_id<>'${officerId}'::uuid) NOT VALID`);
  try{await assert.rejects(mutateFinance(runtime,officer,{...report,requestKey:randomUUID(),reference:failReason}));assert.equal((await owner.query('SELECT count(*)::int AS count FROM school_finance.payments WHERE reference=$1',[failReason])).rows[0].count,0);}finally{await owner.query(`ALTER TABLE school_finance.events DROP CONSTRAINT ${constraint}`);}
 }finally{
  await owner.query('DELETE FROM school_finance.events WHERE school_id=ANY($1::uuid[])',[[school,otherSchool]]);await owner.query('DELETE FROM school_finance.allocations WHERE school_id=ANY($1::uuid[])',[[school,otherSchool]]);await owner.query('DELETE FROM school_finance.payments WHERE school_id=ANY($1::uuid[])',[[school,otherSchool]]);await owner.query('DELETE FROM school_finance.invoices WHERE school_id=ANY($1::uuid[])',[[school,otherSchool]]);await owner.query('DELETE FROM school_finance.accounts WHERE school_id=ANY($1::uuid[])',[[school,otherSchool]]);await owner.query('DELETE FROM school_finance.counters WHERE school_id=ANY($1::uuid[])',[[school,otherSchool]]);await owner.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=ANY($1::text[])',[[school,otherSchool]]);await runtime.end();await owner.end();
 }
});
