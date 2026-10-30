import type { Pool, PoolClient } from "pg";
import { SchoolFinanceError } from "./money";

type Action="finance.reconciliation.prepare"|"finance.reconciliation.approve";
type Authorize=(schoolId:string,action:Action)=>Promise<{schoolId:string;personId:string}>;
type Scope={schoolId:string;accountId:string;actorPersonId:string};
type CreateInput=Scope&{periodStart:string;periodEnd:string};
type ReviewInput=Scope&{reconciliationId:string;decision:"APPROVED"|"REJECTED"};

async function withFinanceTransaction<T>(pool:Pool,run:(db:PoolClient)=>Promise<T>):Promise<T>{
 const db=await pool.connect();
 try{await db.query("BEGIN");const result=await run(db);await db.query("COMMIT");return result;}
 catch(error){await db.query("ROLLBACK");throw error;}
 finally{db.release();}
}
async function scopedAccount(db:PoolClient,scope:Scope){
 const result=await db.query(
  "SELECT id FROM school_finance.accounts WHERE id=$1 AND peos_school_id=$2 AND status='ACTIVE' FOR UPDATE",
  [scope.accountId,scope.schoolId]);
 if(result.rowCount!==1)throw new SchoolFinanceError("FINANCE_ACCOUNT_UNAVAILABLE");
}
async function assertAuthority(scope:Scope,action:Action,authorize:Authorize){
 const decision=await authorize(scope.schoolId,action);
 if(decision.schoolId!==scope.schoolId||decision.personId!==scope.actorPersonId)
  throw new SchoolFinanceError("FINANCE_FORBIDDEN");
}
export async function createSchoolReconciliation(pool:Pool,input:CreateInput,authorize:Authorize){
 await assertAuthority(input,"finance.reconciliation.prepare",authorize);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart)||!/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)||input.periodStart>input.periodEnd)
  throw new SchoolFinanceError("INVALID_RECONCILIATION_PERIOD");
 return withFinanceTransaction(pool,async db=>{
  await scopedAccount(db,input);
  const result=await db.query<{id:string}>(
   `INSERT INTO school_finance.reconciliations(account_id,period_start,period_end,prepared_by_peos_person_id)
    VALUES($1,$2,$3,$4) RETURNING id`,
   [input.accountId,input.periodStart,input.periodEnd,input.actorPersonId]);
  await db.query(`INSERT INTO school_finance.audit_events
   (account_id,actor_peos_person_id,action,resource_type,resource_id)
   VALUES($1,$2,'FINANCE_RECONCILIATION_CREATED','RECONCILIATION',$3)`,
   [input.accountId,input.actorPersonId,result.rows[0].id]);
  return {reconciliationId:result.rows[0].id,status:"DRAFT" as const};
 });
}
export async function submitSchoolReconciliation(pool:Pool,input:Scope&{reconciliationId:string},authorize:Authorize){
 await assertAuthority(input,"finance.reconciliation.prepare",authorize);
 return withFinanceTransaction(pool,async db=>{
  await scopedAccount(db,input);
  const result=await db.query<{id:string}>(
   `UPDATE school_finance.reconciliations SET status='SUBMITTED',submitted_at=now()
    WHERE id=$1 AND account_id=$2 AND status='DRAFT' AND prepared_by_peos_person_id=$3
    RETURNING id`,[input.reconciliationId,input.accountId,input.actorPersonId]);
  if(result.rowCount!==1)throw new SchoolFinanceError("RECONCILIATION_NOT_SUBMITTABLE");
  await db.query(`INSERT INTO school_finance.audit_events
   (account_id,actor_peos_person_id,action,resource_type,resource_id)
   VALUES($1,$2,'FINANCE_RECONCILIATION_SUBMITTED','RECONCILIATION',$3)`,
   [input.accountId,input.actorPersonId,input.reconciliationId]);
  return {reconciliationId:input.reconciliationId,status:"SUBMITTED" as const};
 });
}
export async function reviewSchoolReconciliation(pool:Pool,input:ReviewInput,authorize:Authorize){
 await assertAuthority(input,"finance.reconciliation.approve",authorize);
 return withFinanceTransaction(pool,async db=>{
  await scopedAccount(db,input);
  const result=await db.query<{id:string}>(
   `UPDATE school_finance.reconciliations
    SET status=$4,reviewed_by_peos_person_id=$3,reviewed_at=now()
    WHERE id=$1 AND account_id=$2 AND status='SUBMITTED'
      AND prepared_by_peos_person_id<>$3 RETURNING id`,
   [input.reconciliationId,input.accountId,input.actorPersonId,input.decision]);
  if(result.rowCount!==1)throw new SchoolFinanceError("RECONCILIATION_NOT_REVIEWABLE");
  await db.query(`INSERT INTO school_finance.audit_events
   (account_id,actor_peos_person_id,action,resource_type,resource_id,metadata)
   VALUES($1,$2,'FINANCE_RECONCILIATION_REVIEWED','RECONCILIATION',$3,$4::jsonb)`,
   [input.accountId,input.actorPersonId,input.reconciliationId,JSON.stringify({decision:input.decision})]);
  return {reconciliationId:input.reconciliationId,status:input.decision};
 });
}
