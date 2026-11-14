import test from 'node:test';
import assert from 'node:assert/strict';
import {financeStatus,financeWords,financeDateLabel,suggestedStatementMapping,auditActionLabel} from '../../app/finance/presentation';
test('intake capture never claims that the linked receipt is verified or still pending verification',()=>{
 assert.equal(financeStatus('REPORTED','intake'),'Captured in receipts');
 assert.equal(financeStatus('REPORTED'),'Awaiting verification');
 assert.equal(financeStatus('VERIFIED'),'Verified');
 assert.equal(financeStatus('DISMISSED','intake'),'Excluded from capture');
 assert.equal(financeStatus('REJECTED'),'Rejected');
});
test('statement matching suggests only a unique recognised header for each field',()=>{
 assert.deepEqual(suggestedStatementMapping(['Date','Reference','Amount','Transaction ID']),{date:'Date',reference:'Reference',amount:'Amount',transactionId:'Transaction ID'});
 const ambiguous=suggestedStatementMapping(['Date','Transaction date','Reference','Description','Amount']);
 assert.equal(ambiguous.date,'');assert.equal(ambiguous.reference,'');assert.equal(ambiguous.amount,'Amount');
 assert.deepEqual(suggestedStatementMapping(['Bank day','Payer','Credit']),{date:'',reference:'',amount:''});
});
test('finance labels preserve meaningful abbreviations and display UTC dates without changing the day',()=>{
 assert.equal(financeWords('EFT'),'EFT');assert.equal(financeWords('SCHOOL_FEES'),'School fees');
 assert.equal(auditActionLabel('FINANCE_PAYMENT_REPORTED'),'Receipt captured');
 assert.equal(auditActionLabel('FINANCE_RECONCILIATION_REVIEWED'),'Reconciliation reviewed');
 assert.equal(financeDateLabel('2025-11-30'),financeDateLabel('2025-11-30T23:59:59Z'));
 assert.equal(financeDateLabel('invalid'),'invalid');
});
