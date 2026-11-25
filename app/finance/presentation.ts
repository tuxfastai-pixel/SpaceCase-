export type FinanceIconName='home'|'receipts'|'import'|'budget'|'review'|'audit'|'refresh'|'download'|'print'|'check'|'help'|'back'|'next'|'file'|'team'|'exit'|'warning'|'search';
export const financeSections:{key:string;label:string;hint:string;icon:FinanceIconName}[]=[
 {key:'home',label:'Overview',hint:'Your tasks and next steps',icon:'home'},
 {key:'accounts',label:'Fees & receipts',hint:'Invoices, receipts and allocations',icon:'receipts'},
 {key:'intake',label:'Import receipts',hint:'Statement entries to review',icon:'import'},
 {key:'activities',label:'Activity planning',hint:'Explore contribution plans',icon:'budget'},
 {key:'budgets',label:'Budgets & expenses',hint:'Plan and track expenditure',icon:'budget'},
 {key:'review',label:'Review & reconcile',hint:'Independent checks and approvals',icon:'review'},
 {key:'messages',label:'Parent messages',hint:'Private Finance questions and replies',icon:'team'},
 {key:'team',label:'Finance team',hint:'Invite staff and manage access',icon:'team'},
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
 'FINANCE_FAMILY_ACCOUNT_READ','FINANCE_ACTIVITY_CHARGE_LINKED','FINANCE_ACTIVITY_CHARGE_LINKS_READ','FINANCE_FAMILY_ACTIVITY_PLAN_ACCEPTED','FINANCE_FAMILY_ACTIVITY_PLAN_PREVIEWED','FINANCE_FAMILY_ACTIVITY_PLANS_READ','FINANCE_FAMILY_ACTIVITY_PLAN_STATUS_READ',
 'FINANCE_SAVE_CALENDAR','FINANCE_CREATE_ACTIVITY','FINANCE_EDIT_ACTIVITY','FINANCE_SUBMIT_ACTIVITY','FINANCE_APPROVE_ACTIVITY','FINANCE_REJECT_ACTIVITY','FINANCE_PUBLISH_ACTIVITY','FINANCE_CANCEL_ACTIVITY','FINANCE_ACTIVITY_REGISTER_READ',
 'FINANCE_RECONCILIATION_CREATED','FINANCE_RECONCILIATION_SUBMITTED','FINANCE_RECONCILIATION_REVIEWED',
 'FINANCE_PAYMENT_REPORTED','FINANCE_PAYMENT_REVIEWED','FINANCE_PAYMENT_ALLOCATED','FINANCE_INVOICE_ISSUED',
 'FINANCE_BUDGET_PREPARED','FINANCE_BUDGET_REVIEWED','FINANCE_EXPENSE_SUBMITTED','FINANCE_EXPENSE_REVIEWED',
 'FINANCE_IMPORT_PREVIEWED','FINANCE_IMPORT_SAVED','FINANCE_IMPORT_ITEM_REPORTED','FINANCE_IMPORT_DISMISS','FINANCE_IMPORT_CONFIRM_DISTINCT',
 'FINANCE_AUDIT_HISTORY_READ','FINANCE_AUDIT_HISTORY_EXPORTED','FINANCE_WORKSPACE_READ',
];
export function auditActionLabel(value:string){return ({
 FINANCE_FAMILY_ACCOUNT_READ:'Family billing account viewed',FINANCE_ACTIVITY_CHARGE_LINKED:'Activity invoice linked for family planning',FINANCE_ACTIVITY_CHARGE_LINKS_READ:'Activity invoice links viewed',FINANCE_FAMILY_ACTIVITY_PLAN_ACCEPTED:'Family activity payment plan saved',FINANCE_FAMILY_ACTIVITY_PLAN_PREVIEWED:'Family activity payment plan previewed',FINANCE_FAMILY_ACTIVITY_PLANS_READ:'Family activity payment plans viewed',FINANCE_FAMILY_ACTIVITY_PLAN_STATUS_READ:'Activity plan submission checked',
 FINANCE_SAVE_CALENDAR:'School calendar saved',FINANCE_CREATE_ACTIVITY:'Activity draft created',FINANCE_EDIT_ACTIVITY:'Activity draft updated',FINANCE_SUBMIT_ACTIVITY:'Activity submitted for review',FINANCE_APPROVE_ACTIVITY:'Activity approved',FINANCE_REJECT_ACTIVITY:'Activity returned for changes',FINANCE_PUBLISH_ACTIVITY:'Activity published to staff register',FINANCE_CANCEL_ACTIVITY:'Activity cancelled',FINANCE_ACTIVITY_REGISTER_READ:'Activity register viewed',
 FINANCE_PAYMENT_REPORTED:'Receipt captured',FINANCE_PAYMENT_REVIEWED:'Receipt verification reviewed',FINANCE_PAYMENT_ALLOCATED:'Receipt allocated to invoice',
 FINANCE_IMPORT_PREVIEWED:'Statement preview checked',FINANCE_IMPORT_SAVED:'Statement imported',FINANCE_IMPORT_ITEM_REPORTED:'Statement entry captured as receipt',FINANCE_IMPORT_DISMISS:'Statement entry excluded',FINANCE_IMPORT_CONFIRM_DISTINCT:'Separate transaction confirmed',
 FINANCE_WORKSPACE_READ:'Finance records viewed',FINANCE_AUDIT_HISTORY_READ:'Audit trail viewed',FINANCE_AUDIT_HISTORY_EXPORTED:'Audit trail downloaded',FINANCE_ACCOUNT_INITIALIZED:'School finance account opened',
 } as Record<string,string>)[value]??financeWords(value);}

export function statementFileIssue(headers:string[]):string|null{
 const names=new Set(headers.map(h=>h.trim().toLowerCase()));
 return ['event id','action','resource id','decision'].every(h=>names.has(h))
  ? 'This is an audit-history file. Choose a payment statement CSV containing Date, Reference and Amount columns, with an optional Transaction ID.'
  : null;
}
