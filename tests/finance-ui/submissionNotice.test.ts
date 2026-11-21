import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionNotice,submissionRecordId} from '../../app/finance/submissionNotice';
test('invoice confirmation identifies the saved invoice and where to find it',()=>{
 const notice=submissionNotice({command:'INVOICE',invoiceNumber:'TEST-IMPORT-ALLOC-1'});
 assert.match(notice.message,/TEST-IMPORT-ALLOC-1 issued successfully/);
 assert.match(notice.message,/Fees & receipts → Fee invoices/);
 assert.equal(notice.tab,'accounts');assert.equal(notice.anchor,'finance-fee-invoices');
});
test('confirmation preserves draft, submission, capture and verification distinctions',()=>{
 assert.match(submissionNotice({command:'RECONCILIATION'}).message,/not yet been submitted/);
 assert.match(submissionNotice({command:'SUBMIT_RECONCILIATION'}).message,/submitted for independent review/);
 assert.match(submissionNotice({command:'PAYMENT'}).message,/awaiting independent verification/);
 assert.match(submissionNotice({command:'VERIFY_PAYMENT',decision:'REJECTED'}).message,/rejected/);
 assert.match(submissionNotice({command:'REVIEW_RECONCILIATION',decision:'REJECTED'}).message,/Reconciliation rejected/);
 assert.match(submissionNotice({command:'VERIFY_PAYMENT',decision:'VERIFIED'}).message,/verified successfully/);
});
test('allocation success points to balances, without inventing full payment or settlement',()=>{
 const notice=submissionNotice({command:'ALLOCATE'});
 assert.match(notice.message,/updated allocated and outstanding amounts/);
 assert.doesNotMatch(notice.message,/fully paid|settled/i);
 assert.equal(notice.anchor,'finance-fee-invoices');
});

test('highlight locates the saved row, using the invoice rather than allocation ID',()=>{
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 assert.equal(submissionRecordId({command:'INVOICE'},{id}),id);
 assert.equal(submissionRecordId({command:'ALLOCATE',invoiceId:id},{allocationId:other}),id);
 assert.equal(submissionRecordId({command:'REVIEW_RECONCILIATION'},{reconciliationId:id}),id);
 assert.equal(submissionRecordId({command:'INVOICE'},{id:'untrusted selector'}),undefined);
 assert.equal(submissionRecordId({command:'INVOICE'},{}),undefined);
});
