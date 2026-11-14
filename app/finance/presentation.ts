export type FinanceIconName='receipts'|'import'|'budget'|'review'|'audit'|'refresh'|'download'|'print'|'check'|'help'|'back'|'next'|'file'|'team'|'exit'|'warning'|'search';
export const financeSections:{key:string;label:string;hint:string;icon:FinanceIconName}[]=[
 {key:'accounts',label:'Fees & receipts',hint:'Invoices, receipts and allocations',icon:'receipts'},
 {key:'intake',label:'Import receipts',hint:'Statement entries to review',icon:'import'},
 {key:'budgets',label:'Budgets & expenses',hint:'Plan and track expenditure',icon:'budget'},
 {key:'review',label:'Review & reconcile',hint:'Independent checks and approvals',icon:'review'},
 {key:'audit',label:'Audit trail',hint:'Decisions, reasons and downloads',icon:'audit'},
];
const statusLabels:Record<string,string>={READY:'Awaiting capture',DUPLICATE_REVIEW:'Check for duplicate',DISMISSED:'Excluded from capture',REPORTED:'Awaiting verification',VERIFIED:'Verified',REJECTED:'Rejected',APPROVED:'Approved',SUBMITTED:'Awaiting review',DRAFT:'Draft',ISSUED:'Issued',DISPUTED:'Disputed',VOID:'Void'};
export function financeStatus(value:string,context:'ledger'|'intake'='ledger'){
 if(context==='intake'&&value==='REPORTED')return 'Captured in receipts';
 return statusLabels[value]??financeWords(value);
}
export function financeWords(value:string){if(value==='EFT')return 'EFT';const words=value.replace(/^FINANCE_/,'').replaceAll('_',' ').toLowerCase();return words.charAt(0).toUpperCase()+words.slice(1);}
export function financeDateLabel(value:string){
 const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00Z':value);
 return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('en-ZA',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}
export function suggestedStatementMapping(headers:string[]){
 const aliases={date:['date','transaction date'],reference:['reference','payment reference','description'],amount:['amount','signed amount'],transactionId:['transaction id','unique transaction id']};
 const result:Record<string,string>={};
 for(const [field,names] of Object.entries(aliases)){const matches=headers.filter(h=>names.includes(h.trim().toLowerCase()));if(matches.length===1)result[field]=matches[0];}
 return {date:result.date??'',reference:result.reference??'',amount:result.amount??'',...(result.transactionId?{transactionId:result.transactionId}:{})};
}
export const auditActions=[
 'FINANCE_RECONCILIATION_CREATED','FINANCE_RECONCILIATION_SUBMITTED','FINANCE_RECONCILIATION_REVIEWED',
 'FINANCE_PAYMENT_REPORTED','FINANCE_PAYMENT_REVIEWED','FINANCE_PAYMENT_ALLOCATED','FINANCE_INVOICE_ISSUED',
 'FINANCE_BUDGET_PREPARED','FINANCE_BUDGET_REVIEWED','FINANCE_EXPENSE_SUBMITTED','FINANCE_EXPENSE_REVIEWED',
 'FINANCE_IMPORT_PREVIEWED','FINANCE_IMPORT_SAVED','FINANCE_IMPORT_ITEM_REPORTED','FINANCE_IMPORT_DISMISS','FINANCE_IMPORT_CONFIRM_DISTINCT',
 'FINANCE_AUDIT_HISTORY_READ','FINANCE_AUDIT_HISTORY_EXPORTED','FINANCE_WORKSPACE_READ',
];
export function auditActionLabel(value:string){return ({
 FINANCE_PAYMENT_REPORTED:'Receipt captured',FINANCE_PAYMENT_REVIEWED:'Receipt verification reviewed',FINANCE_PAYMENT_ALLOCATED:'Receipt allocated to invoice',
 FINANCE_IMPORT_PREVIEWED:'Statement preview checked',FINANCE_IMPORT_SAVED:'Statement imported',FINANCE_IMPORT_ITEM_REPORTED:'Statement entry captured as receipt',FINANCE_IMPORT_DISMISS:'Statement entry excluded',FINANCE_IMPORT_CONFIRM_DISTINCT:'Separate transaction confirmed',
 FINANCE_WORKSPACE_READ:'Finance records viewed',FINANCE_AUDIT_HISTORY_READ:'Audit trail viewed',FINANCE_AUDIT_HISTORY_EXPORTED:'Audit trail downloaded',FINANCE_ACCOUNT_INITIALIZED:'School finance account opened',
 } as Record<string,string>)[value]??financeWords(value);}
