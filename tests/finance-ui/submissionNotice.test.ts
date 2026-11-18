import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionNotice} from '../../app/finance/submissionNotice';
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
