export type SubmissionNotice={message:string;location:string;tab:string;anchor:string;recordId?:string};
/** Only call after the server acknowledges a successful command. */
export function submissionNotice(input:Record<string,unknown>):SubmissionNotice{
 const invoices={location:'Fee invoices',tab:'accounts',anchor:'finance-fee-invoices'};
 const receipts={location:'Receipt register',tab:'accounts',anchor:'finance-receipt-register'};
 const budgets={location:'Budgets & expenses',tab:'budgets',anchor:'finance-budgets'};
 const reconciliation={location:'Ledger reconciliation',tab:'review',anchor:'finance-reconciliation'};
 const reviewed=input.decision==='APPROVED'?'approved':input.decision==='REJECTED'?'rejected':'reviewed';
 switch(input.command){
  case 'INVOICE':return {...invoices,message:`Invoice ${String(input.invoiceNumber??'').trim()} issued successfully. You can find it under Fees & receipts → Fee invoices.`};
  case 'PAYMENT':return {...receipts,message:'Receipt captured successfully. Find it under Fees & receipts → Receipt register, awaiting independent verification.'};
  case 'VERIFY_PAYMENT':return {...receipts,message:input.decision==='VERIFIED'?'Receipt verified successfully. Find its current status and available amount in the Receipt register.':'Receipt rejected. Find its status in the Receipt register; the decision is retained in the audit trail.'};
  case 'ALLOCATE':return {...invoices,message:'Allocation saved successfully. View the invoice’s updated allocated and outstanding amounts in Fee invoices. The remaining receipt balance is in the Receipt register.'};
  case 'BUDGET':return {...budgets,message:'Budget prepared successfully. Find it under Budgets & expenses, awaiting independent review.'};
  case 'EXPENSE':return {...budgets,message:'Expense submitted successfully. Find it under Budgets & expenses, awaiting independent review.'};
  case 'REVIEW_BUDGET':return {...budgets,message:`Budget ${reviewed}. Find its status under Budgets & expenses; the review decision is retained.`};
  case 'REVIEW_EXPENSE':return {...budgets,message:`Expense ${reviewed}. Find its status under Budgets & expenses; the review decision is retained.`};
  case 'RECONCILIATION':return {...reconciliation,message:'Reconciliation draft created successfully. Find it under Review & reconcile → Ledger reconciliation. It has not yet been submitted for review.'};
  case 'SUBMIT_RECONCILIATION':return {...reconciliation,message:'Reconciliation snapshot submitted for independent review. Find its status under Review & reconcile → Ledger reconciliation.'};
  case 'REVIEW_RECONCILIATION':return {...reconciliation,message:`Reconciliation ${reviewed}. Find its current status under Ledger reconciliation; earlier decisions remain in the audit trail.`};
  case 'INITIALIZE':return {...invoices,location:'Finance records',message:'School finance account set up successfully. Your Finance records are now available.'};
  default:return {...invoices,location:'Finance records',message:'Saved successfully. View the latest Finance records.'};
 }
}

/** Allocation responses identify the allocation, so locate its invoice instead. */
export function submissionRecordId(input:Record<string,unknown>,result:Record<string,unknown>):string|undefined{
 const id=input.command==='ALLOCATE'?input.invoiceId:result.reconciliationId??result.id;
 return typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?id:undefined;
}
