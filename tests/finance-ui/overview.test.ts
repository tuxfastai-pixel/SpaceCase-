import {test} from 'node:test';
import assert from 'node:assert/strict';
import {financeOverview} from '../../app/finance/overview';
test('overview distinguishes unavailable records from a loaded empty register',()=>{
 assert.deepEqual(financeOverview(undefined,undefined,'me'),{awaiting:null,reviewable:null,available:null,outstanding:undefined});
 assert.deepEqual(financeOverview([],[],'me'),{awaiting:0,reviewable:0,available:0,outstanding:[]});
});
test('overview preserves independent review and excludes exhausted or unverified balances',()=>{
 const payment={verification:'REPORTED',preparedBy:'me',amountMinor:'100',allocatedMinor:'0'};
 const result=financeOverview([], [payment,{...payment,preparedBy:'other'},{...payment,verification:'VERIFIED'},{...payment,verification:'VERIFIED',allocatedMinor:'100'},{...payment,verification:'REJECTED'}],'me');
 assert.equal(result.awaiting,2);assert.equal(result.reviewable,1);assert.equal(result.available,1);
});
test('outstanding invoice selection uses exact minor units and ignores void invoices',()=>{
 const invoice={id:'1',invoiceNumber:'test',status:'ISSUED',amountMinor:'9007199254740993',allocatedMinor:'9007199254740992'};
 assert.deepEqual(financeOverview([invoice,{...invoice,id:'2',status:'VOID'},{...invoice,id:'3',allocatedMinor:invoice.amountMinor}],[],'me').outstanding,[invoice]);
});
