import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createSchoolReconciliation, submitSchoolReconciliation, reviewSchoolReconciliation } from "../../domains/school-finance/reconciliationService";

test("reconciliation rejects self-review even if authority permits it, and prevents duplicate periods",{timeout:30000},async t=>{
 if(!process.env.DATABASE_URL){t.skip("DATABASE_URL required");return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3});
 const schoolId=randomUUID(),accountId=randomUUID(),preparer=randomUUID(),principal=randomUUID();
 const scope={schoolId,accountId};
 const preparerAuth=async(school:string)=>({schoolId:school,personId:preparer});
 const principalAuth=async(school:string)=>({schoolId:school,personId:principal});
 try{
  await pool.query("INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)",[schoolId]);
  await pool.query("INSERT INTO school_finance.accounts(id,peos_school_id,status) VALUES($1,$2,'ACTIVE')",[accountId,schoolId]);
  const data={...scope,actorPersonId:preparer,periodStart:"2026-08-01",periodEnd:"2026-08-31"};
  const created=await createSchoolReconciliation(pool,data,preparerAuth);
  await assert.rejects(createSchoolReconciliation(pool,data,preparerAuth),/duplicate key value/);
  await submitSchoolReconciliation(pool,{...scope,actorPersonId:preparer,reconciliationId:created.reconciliationId},preparerAuth);
  await assert.rejects(reviewSchoolReconciliation(pool,{...scope,actorPersonId:preparer,reconciliationId:created.reconciliationId,decision:"APPROVED"},preparerAuth),/RECONCILIATION_NOT_REVIEWABLE/);
  const reviewed=await reviewSchoolReconciliation(pool,{...scope,actorPersonId:principal,reconciliationId:created.reconciliationId,decision:"REJECTED"},principalAuth);
  assert.equal(reviewed.status,"REJECTED");
  const rows=await pool.query<{status:string;prepared_by_peos_person_id:string;reviewed_by_peos_person_id:string}>(
   "SELECT status,prepared_by_peos_person_id,reviewed_by_peos_person_id FROM school_finance.reconciliations WHERE id=$1",[created.reconciliationId]);
  assert.equal(rows.rows[0].status,"REJECTED");
  assert.notEqual(rows.rows[0].prepared_by_peos_person_id,rows.rows[0].reviewed_by_peos_person_id);
  const audit=await pool.query<{count:string}>("SELECT COUNT(*)::text count FROM school_finance.audit_events WHERE account_id=$1",[accountId]);
  assert.equal(audit.rows[0].count,"3");
 }finally{
  await pool.query("DELETE FROM school_finance.audit_events WHERE account_id=$1",[accountId]).catch(()=>{});
  await pool.query("DELETE FROM school_finance.reconciliations WHERE account_id=$1",[accountId]).catch(()=>{});
  await pool.query("DELETE FROM school_finance.accounts WHERE id=$1",[accountId]).catch(()=>{});
  await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[schoolId]).catch(()=>{});
  await pool.end();
 }
});
