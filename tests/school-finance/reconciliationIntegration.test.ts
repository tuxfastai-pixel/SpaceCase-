import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createSchoolReconciliation, submitSchoolReconciliation, reviewSchoolReconciliation } from "../../domains/school-finance/reconciliationService";

test("reconciliation workflow enforces scoped approval, one-time transitions and audit", {timeout:30000}, async t=>{
 if(!process.env.DATABASE_URL){t.skip("DATABASE_URL required");return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
 const schoolId=randomUUID(),accountId=randomUUID(),preparer=randomUUID(),principal=randomUUID();
 const authorize=async(school:string,action:string)=>({schoolId:school,personId:action==="finance.reconciliation.approve"?principal:preparer});
 const base={schoolId,accountId};
 try{
  await pool.query("INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)",[schoolId]);
  await pool.query("INSERT INTO school_finance.accounts(id,peos_school_id,status) VALUES($1,$2,'ACTIVE')",[accountId,schoolId]);
  const created=await createSchoolReconciliation(pool,{...base,actorPersonId:preparer,periodStart:"2026-09-01",periodEnd:"2026-09-30"},authorize);
  assert.equal(created.status,"DRAFT");
  await assert.rejects(reviewSchoolReconciliation(pool,{...base,actorPersonId:principal,reconciliationId:created.reconciliationId,reason:"Independent review",decision:"APPROVED"},authorize),/RECONCILIATION_NOT_REVIEWABLE/);
  const submitted=await submitSchoolReconciliation(pool,{...base,actorPersonId:preparer,reconciliationId:created.reconciliationId,evidenceReference:"private-register-1"},authorize);
  assert.equal(submitted.status,"SUBMITTED");
  await assert.rejects(submitSchoolReconciliation(pool,{...base,actorPersonId:preparer,reconciliationId:created.reconciliationId,evidenceReference:"private-register-1"},authorize),/RECONCILIATION_NOT_SUBMITTABLE/);
  await assert.rejects(reviewSchoolReconciliation(pool,{...base,actorPersonId:preparer,reconciliationId:created.reconciliationId,reason:"Independent review",decision:"APPROVED"},authorize),/FINANCE_FORBIDDEN/);
  // Even if PEOS grants this person both prepare and approve actions, self-approval is forbidden.
  const dualPermissionAuthorize=async(school:string)=>({schoolId:school,personId:preparer});
  await assert.rejects(reviewSchoolReconciliation(pool,{...base,actorPersonId:preparer,reconciliationId:created.reconciliationId,reason:"Attempted self approval",decision:"APPROVED"},dualPermissionAuthorize),/RECONCILIATION_NOT_REVIEWABLE/);
  await assert.rejects(reviewSchoolReconciliation(pool,{...base,schoolId:randomUUID(),actorPersonId:principal,reconciliationId:created.reconciliationId,reason:"Independent review",decision:"APPROVED"},authorize),/FINANCE_ACCOUNT_UNAVAILABLE/);
  // Competing independent reviewers may produce only one committed decision and audit event.
  const secondReviewer=randomUUID();
  const reviews=await Promise.allSettled([
   reviewSchoolReconciliation(pool,{...base,actorPersonId:principal,reconciliationId:created.reconciliationId,reason:"Independent review",decision:"APPROVED"},authorize),
   reviewSchoolReconciliation(pool,{...base,actorPersonId:secondReviewer,reconciliationId:created.reconciliationId,reason:"Evidence rejected",decision:"REJECTED"},async school=>({schoolId:school,personId:secondReviewer})),
  ]);
  assert.equal(reviews.filter(r=>r.status==="fulfilled").length,1);
  const failed=reviews.find(r=>r.status==="rejected") as PromiseRejectedResult;
  assert.match(failed.reason.message,/RECONCILIATION_NOT_REVIEWABLE/);
  const winner=reviews.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<{status:string}>;
  const stored=await pool.query("SELECT status,reviewed_by_peos_person_id,review_reason FROM school_finance.reconciliations WHERE id=$1",[created.reconciliationId]);
  assert.equal(stored.rows[0].status,winner.value.status);
  const reviewAudit=await pool.query("SELECT actor_peos_person_id,metadata FROM school_finance.audit_events WHERE account_id=$1 AND action='FINANCE_RECONCILIATION_REVIEWED'",[accountId]);
  assert.equal(reviewAudit.rowCount,1);
  assert.equal(reviewAudit.rows[0].actor_peos_person_id,stored.rows[0].reviewed_by_peos_person_id);
  assert.deepEqual(reviewAudit.rows[0].metadata,{decision:stored.rows[0].status,reason:stored.rows[0].review_reason});
  await assert.rejects(reviewSchoolReconciliation(pool,{...base,actorPersonId:principal,reconciliationId:created.reconciliationId,reason:"Independent review",decision:"REJECTED"},authorize),/RECONCILIATION_NOT_REVIEWABLE/);
  const audit=await pool.query<{action:string}>("SELECT action FROM school_finance.audit_events WHERE account_id=$1 ORDER BY occurred_at",[accountId]);
  assert.deepEqual(audit.rows.map(r=>r.action),["FINANCE_RECONCILIATION_CREATED","FINANCE_RECONCILIATION_SUBMITTED","FINANCE_RECONCILIATION_REVIEWED"]);
 }finally{
  await pool.query("DELETE FROM school_finance.audit_events WHERE account_id=$1",[accountId]).catch(()=>{});
  await pool.query("DELETE FROM school_finance.reconciliation_versions WHERE account_id=$1",[accountId]).catch(()=>{});
  await pool.query("DELETE FROM school_finance.reconciliations WHERE account_id=$1",[accountId]).catch(()=>{});
  await pool.query("DELETE FROM school_finance.accounts WHERE id=$1",[accountId]).catch(()=>{});
  await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[schoolId]).catch(()=>{});
  await pool.end();
 }
});
