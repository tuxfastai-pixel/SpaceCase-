import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingActivityInvoices,type ActivityInvoiceChoice} from '../../app/finance/activityChargeChoices';
const activity={id:'trip',status:'PUBLISHED',details:{amountMinor:'35000',paymentDeadline:'2027-06-11'}};
const invoice:ActivityInvoiceChoice={id:'invoice',invoiceNumber:'TRIP-1',learnerId:'learner',amountMinor:'35000',dueDate:'2027-06-11',status:'ISSUED'};
test('activity account choices require a published activity and confirmed learner',()=>{
 assert.deepEqual(matchingActivityInvoices([invoice],undefined,'learner',[]),[]);
 assert.deepEqual(matchingActivityInvoices([invoice],{...activity,status:'CANCELLED'},'learner',[]),[]);
 assert.deepEqual(matchingActivityInvoices([invoice],activity,undefined,[]),[]);
});
test('activity account choices cannot suggest a different learner, amount, deadline or invoice status',()=>{
 const rows=[invoice,{...invoice,id:'other-learner',learnerId:'other'},{...invoice,id:'other-amount',amountMinor:'34999'},{...invoice,id:'other-date',dueDate:'2027-06-12'},{...invoice,id:'void',status:'VOID'}];
 assert.deepEqual(matchingActivityInvoices(rows,activity,'learner',[]),[invoice]);
});
test('invoice connected to another activity is excluded without hiding the same activity replay',()=>{
 assert.deepEqual(matchingActivityInvoices([invoice],activity,'learner',[{id:'saved',activityId:'other',invoiceId:'invoice',learnerId:'learner'}]),[]);
 assert.deepEqual(matchingActivityInvoices([invoice],activity,'learner',[{id:'saved',activityId:'trip',invoiceId:'invoice',learnerId:'learner'}]),[invoice]);
 assert.deepEqual(invoice,{id:'invoice',invoiceNumber:'TRIP-1',learnerId:'learner',amountMinor:'35000',dueDate:'2027-06-11',status:'ISSUED'});
});
