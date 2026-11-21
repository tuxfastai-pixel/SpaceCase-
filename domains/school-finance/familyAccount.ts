import type {Pool} from 'pg';
import type {FamilyBillingDecision} from '../../platform/family/billingAuthority';
import {FamilyBillingError} from '../../platform/family/billingAuthority';
import {financeTransaction,financeAudit} from './workspaceService';
function sameScope(a:FamilyBillingDecision,b:FamilyBillingDecision){return ['grantId','personId','schoolId','learnerPersonId','action','contractVersion'].every(k=>a[k as keyof FamilyBillingDecision]===b[k as keyof FamilyBillingDecision])&&b.action==='family.finance.read'&&Date.parse(b.expiresAt)>Date.now();}
export async function readFamilyFinanceAccount(pool:Pool,grantId:string,authorize:(id:string)=>Promise<FamilyBillingDecision>){
 const scope=await authorize(grantId);if(scope.grantId!==grantId||scope.action!=='family.finance.read'||Date.parse(scope.expiresAt)<=Date.now())throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');
 return financeTransaction(pool,async db=>{
  const accounts=await db.query("SELECT id FROM school_finance.accounts WHERE peos_school_id=$1 AND status='ACTIVE'",[scope.schoolId]);const account=accounts.rows[0];if(!account)throw new FamilyBillingError(404,'FAMILY_ACCOUNT_UNAVAILABLE');
  const rows=await db.query(`SELECT i.id,i.invoice_number AS "invoiceNumber",i.description,i.category,i.due_date::text AS "dueDate",i.status,i.amount_minor::text AS "amountMinor",COALESCE((SELECT SUM(a.amount_minor) FROM school_finance.allocations a WHERE a.account_id=i.account_id AND a.invoice_id=i.id),0)::text AS "allocatedMinor" FROM school_finance.invoices i WHERE i.account_id=$1 AND i.peos_learner_id=$2 ORDER BY i.created_at DESC,i.id LIMIT 101`,[account.id,scope.learnerPersonId]);
  const totals=await db.query(`SELECT COALESCE(SUM(i.amount_minor),0)::text AS "invoicedMinor",COALESCE(SUM((SELECT COALESCE(SUM(a.amount_minor),0) FROM school_finance.allocations a WHERE a.account_id=i.account_id AND a.invoice_id=i.id)),0)::text AS "allocatedMinor" FROM school_finance.invoices i WHERE i.account_id=$1 AND i.peos_learner_id=$2 AND i.status='ISSUED'`,[account.id,scope.learnerPersonId]);
  if(!sameScope(scope,await authorize(grantId)))throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');
  await financeAudit(db,{schoolId:scope.schoolId,accountId:account.id,actorPersonId:scope.personId},'FINANCE_FAMILY_ACCOUNT_READ','LEARNER',scope.learnerPersonId);
  return {invoices:rows.rows.slice(0,100),totals:totals.rows[0],truncated:rows.rows.length>100};
 });
}
