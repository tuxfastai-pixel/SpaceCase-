import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { allocateVerifiedSchoolPayment } from "../../domains/school-finance/allocationService";

test("verified allocations serialize competing requests and roll back failures", {timeout:30000}, async t => {
  if (!process.env.DATABASE_URL) { t.skip("DATABASE_URL required"); return; }
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5});
  const schoolId=randomUUID(),accountId=randomUUID(),actorId=randomUUID();
  const paymentId=randomUUID(),invoiceA=randomUUID(),invoiceB=randomUUID();
  const authorize=async(school:string)=>({schoolId:school,personId:actorId});
  try {
    await pool.query("INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)",[schoolId]);
    await pool.query("INSERT INTO school_finance.accounts(id,peos_school_id,status) VALUES($1,$2,'ACTIVE')",[accountId,schoolId]);
    await pool.query(`INSERT INTO school_finance.payments
      (id,account_id,external_reference,amount_minor,verification,verification_evidence_ref,verified_by_peos_person_id,verified_at,recorded_by_peos_person_id)
      VALUES($1,$2,'test-payment',100,'VERIFIED','test-evidence',$3,now(),$3)`,[paymentId,accountId,actorId]);
    for(const [id,number] of [[invoiceA,"A"],[invoiceB,"B"]]){
      await pool.query(`INSERT INTO school_finance.invoices
        (id,account_id,peos_learner_id,invoice_number,amount_minor,due_date,created_by_peos_person_id)
        VALUES($1,$2,$3,$4,100,CURRENT_DATE,$5)`,[id,accountId,randomUUID(),number,actorId]);
    }
    const input=(invoiceId:string,amountMinor:string)=>({accountId,schoolId,paymentId,invoiceId,amountMinor,actorPersonId:actorId});
    const results=await Promise.allSettled([
      allocateVerifiedSchoolPayment(pool,input(invoiceA,"80"),authorize),
      allocateVerifiedSchoolPayment(pool,input(invoiceB,"80"),authorize),
    ]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(results.filter(r=>r.status==="rejected").length,1);
    const totals=await pool.query<{total:string;count:string}>(
      "SELECT COALESCE(SUM(amount_minor),0)::text total,COUNT(*)::text count FROM school_finance.allocations WHERE account_id=$1",[accountId]);
    assert.equal(totals.rows[0].total,"80");
    assert.equal(totals.rows[0].count,"1");
    await assert.rejects(allocateVerifiedSchoolPayment(pool,input(invoiceA,"30"),authorize));
    const after=await pool.query<{count:string}>("SELECT COUNT(*)::text count FROM school_finance.allocations WHERE account_id=$1",[accountId]);
    assert.equal(after.rows[0].count,"1");
    const audit=await pool.query<{count:string}>("SELECT COUNT(*)::text count FROM school_finance.audit_events WHERE account_id=$1 AND action='FINANCE_PAYMENT_ALLOCATED'",[accountId]);
    assert.equal(audit.rows[0].count,"1");
    await pool.query("UPDATE school_finance.payments SET verification='REPORTED',verified_at=NULL,verified_by_peos_person_id=NULL,verification_evidence_ref=NULL WHERE id=$1",[paymentId]);
    await assert.rejects(allocateVerifiedSchoolPayment(pool,input(invoiceB,"10"),authorize),/VERIFIED_PAYMENT_REQUIRED/);
  } finally {
    await pool.query("DELETE FROM school_finance.audit_events WHERE account_id=$1",[accountId]).catch(()=>{});
    await pool.query("DELETE FROM school_finance.allocations WHERE account_id=$1",[accountId]).catch(()=>{});
    await pool.query("DELETE FROM school_finance.invoices WHERE account_id=$1",[accountId]).catch(()=>{});
    await pool.query("DELETE FROM school_finance.payments WHERE account_id=$1",[accountId]).catch(()=>{});
    await pool.query("DELETE FROM school_finance.accounts WHERE id=$1",[accountId]).catch(()=>{});
    await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[schoolId]).catch(()=>{});
    await pool.end();
  }
});
