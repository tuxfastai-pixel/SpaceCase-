import type { Pool, PoolClient } from "pg";
import { SchoolFinanceError } from "./money";
import { financeDate } from "./workspaceContracts";

type Action="finance.reconciliation.prepare"|"finance.reconciliation.approve";
type Authorize=(schoolId:string,action:Action)=>Promise<{schoolId:string;personId:string}>;
type Scope={schoolId:string;accountId:string;actorPersonId:string};
type CreateInput=Scope&{periodStart:string;periodEnd:string};
type ReviewInput=Scope&{reconciliationId:string;decision:"APPROVED"|"REJECTED";reason:string};

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
 if(!financeDate.safeParse(input.periodStart).success||!financeDate.safeParse(input.periodEnd).success||input.periodStart>input.periodEnd)
  throw new SchoolFinanceError("INVALID_RECONCILIATION_PERIOD");
 return withFinanceTransaction(pool,async db=>{
  await scopedAccount(db,input);
  const result=await db.query<{id:string}>(
   `INSERT INTO school_finance.reconciliations(account_id,period_start,period_end,prepared_by_peos_person_id)
    VALUES($1,$2,$3,$4)
    ON CONFLICT(account_id,period_start,period_end) DO UPDATE SET status='DRAFT',reviewed_by_peos_person_id=NULL,
      reviewed_at=NULL,submitted_at=NULL,evidence_reference=NULL,ledger_snapshot=NULL,review_reason=NULL,
      revision=school_finance.reconciliations.revision+1
    WHERE school_finance.reconciliations.status='REJECTED' AND school_finance.reconciliations.prepared_by_peos_person_id=$4
    RETURNING id`,
   [input.accountId,input.periodStart,input.periodEnd,input.actorPersonId]);
  if(!result.rows[0])throw new SchoolFinanceError("RECONCILIATION_ALREADY_EXISTS");
  await db.query(`INSERT INTO school_finance.audit_events
   (account_id,actor_peos_person_id,action,resource_type,resource_id)
   VALUES($1,$2,'FINANCE_RECONCILIATION_CREATED','RECONCILIATION',$3)`,
   [input.accountId,input.actorPersonId,result.rows[0].id]);
  return {reconciliationId:result.rows[0].id,status:"DRAFT" as const};
 });
}
export async function submitSchoolReconciliation(pool:Pool,input:Scope&{reconciliationId:string;evidenceReference:string},authorize:Authorize){
 await assertAuthority(input,"finance.reconciliation.prepare",authorize);
 return withFinanceTransaction(pool,async db=>{
  await scopedAccount(db,input);
  if(!input.evidenceReference.trim()||input.evidenceReference.length>200)throw new SchoolFinanceError("RECONCILIATION_EVIDENCE_REQUIRED");
  const period=await db.query<{period_start:string;period_end:string}>("SELECT period_start::text,period_end::text FROM school_finance.reconciliations WHERE id=$1 AND account_id=$2",[input.reconciliationId,input.accountId]);
  if(!period.rows[0])throw new SchoolFinanceError("RECONCILIATION_NOT_SUBMITTABLE");
  const snapshot=await ledgerSnapshot(db,input.accountId,period.rows[0].period_start,period.rows[0].period_end);
  const result=await db.query<{id:string}>(
   `UPDATE school_finance.reconciliations SET status='SUBMITTED',submitted_at=now(),evidence_reference=$4,ledger_snapshot=$5::jsonb
    WHERE id=$1 AND account_id=$2 AND status='DRAFT' AND prepared_by_peos_person_id=$3
    RETURNING id`,[input.reconciliationId,input.accountId,input.actorPersonId,input.evidenceReference,JSON.stringify(snapshot)]);
  if(result.rowCount!==1)throw new SchoolFinanceError("RECONCILIATION_NOT_SUBMITTABLE");
  await db.query(`INSERT INTO school_finance.reconciliation_versions(account_id,reconciliation_id,revision,evidence_reference,ledger_snapshot,submitted_by_peos_person_id) SELECT account_id,id,revision,evidence_reference,ledger_snapshot,$3 FROM school_finance.reconciliations WHERE id=$1 AND account_id=$2`,[input.reconciliationId,input.accountId,input.actorPersonId]);
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
  if(!input.reason.trim()||input.reason.length>500)throw new SchoolFinanceError("RECONCILIATION_REVIEW_REASON_REQUIRED");
  const record=await db.query<{period_start:string;period_end:string;status:string;prepared_by_peos_person_id:string;ledger_snapshot:{fingerprint:string}|null}>("SELECT period_start::text,period_end::text,status,prepared_by_peos_person_id,ledger_snapshot FROM school_finance.reconciliations WHERE id=$1 AND account_id=$2",[input.reconciliationId,input.accountId]);
  if(!record.rows[0]||record.rows[0].status!=='SUBMITTED'||record.rows[0].prepared_by_peos_person_id===input.actorPersonId)throw new SchoolFinanceError('RECONCILIATION_NOT_REVIEWABLE');
  if(input.decision==='APPROVED'){
   const current=await ledgerSnapshot(db,input.accountId,record.rows[0].period_start,record.rows[0].period_end);
   if(!record.rows[0].ledger_snapshot||current.fingerprint!==record.rows[0].ledger_snapshot.fingerprint)throw new SchoolFinanceError("RECONCILIATION_LEDGER_CHANGED");
  }
  const result=await db.query<{id:string}>(
   `UPDATE school_finance.reconciliations
    SET status=$4,reviewed_by_peos_person_id=$3,reviewed_at=now(),review_reason=$5
    WHERE id=$1 AND account_id=$2 AND status='SUBMITTED'
      AND prepared_by_peos_person_id<>$3 RETURNING id`,
   [input.reconciliationId,input.accountId,input.actorPersonId,input.decision,input.reason]);
  if(result.rowCount!==1)throw new SchoolFinanceError("RECONCILIATION_NOT_REVIEWABLE");
  await db.query(`INSERT INTO school_finance.audit_events
   (account_id,actor_peos_person_id,action,resource_type,resource_id,metadata)
   VALUES($1,$2,'FINANCE_RECONCILIATION_REVIEWED','RECONCILIATION',$3,$4::jsonb)`,
   [input.accountId,input.actorPersonId,input.reconciliationId,JSON.stringify({decision:input.decision,reason:input.reason})]);
  return {reconciliationId:input.reconciliationId,status:input.decision};
 });
}

/** Period is based on UTC record timestamps, not invoice due dates or bank value dates. */
async function ledgerSnapshot(db:PoolClient,accountId:string,start:string,end:string){
 const result=await db.query<{fingerprint:string;recordCount:string;invoicedMinor:string;verifiedMinor:string;allocatedMinor:string;approvedExpensesMinor:string}>(`
  WITH records AS (
   SELECT 'I:'||id||':'||amount_minor||':'||status AS value,CASE WHEN status='ISSUED' THEN amount_minor ELSE 0 END amount_minor,'I' kind FROM school_finance.invoices WHERE account_id=$1 AND created_at >= $2::date AT TIME ZONE 'UTC' AND created_at < ($3::date+1) AT TIME ZONE 'UTC'
   UNION ALL SELECT 'P:'||id||':'||amount_minor||':'||verification,CASE WHEN verification='VERIFIED' THEN amount_minor ELSE 0 END,'P' FROM school_finance.payments WHERE account_id=$1 AND recorded_at >= $2::date AT TIME ZONE 'UTC' AND recorded_at < ($3::date+1) AT TIME ZONE 'UTC'
   UNION ALL SELECT 'A:'||id||':'||amount_minor,amount_minor,'A' FROM school_finance.allocations WHERE account_id=$1 AND allocated_at >= $2::date AT TIME ZONE 'UTC' AND allocated_at < ($3::date+1) AT TIME ZONE 'UTC'
   UNION ALL SELECT 'E:'||id||':'||amount_minor||':'||status,CASE WHEN status='APPROVED' THEN amount_minor ELSE 0 END,'E' FROM school_finance.expenses WHERE account_id=$1 AND created_at >= $2::date AT TIME ZONE 'UTC' AND created_at < ($3::date+1) AT TIME ZONE 'UTC'
  ) SELECT encode(sha256(convert_to(COALESCE(string_agg(value,'|' ORDER BY value),''),'UTF8')),'hex') fingerprint,
   COUNT(*)::text AS "recordCount",COALESCE(SUM(amount_minor) FILTER(WHERE kind='I'),0)::text AS "invoicedMinor",
   COALESCE(SUM(amount_minor) FILTER(WHERE kind='P'),0)::text AS "verifiedMinor",COALESCE(SUM(amount_minor) FILTER(WHERE kind='A'),0)::text AS "allocatedMinor",
   COALESCE(SUM(amount_minor) FILTER(WHERE kind='E'),0)::text AS "approvedExpensesMinor" FROM records`,[accountId,start,end]);
 return result.rows[0];
}
