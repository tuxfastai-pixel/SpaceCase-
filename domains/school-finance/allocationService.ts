import type { Pool, PoolClient } from "pg";
import { planVerifiedAllocation, minorUnits, SchoolFinanceError } from "./money";

type AllocationInput = {
  accountId: string; schoolId: string; paymentId: string; invoiceId: string;
  amountMinor: string; actorPersonId: string;
};
type Authority = (schoolId: string, action: "finance.transactions.record") => Promise<{schoolId:string;personId:string}>;

/**
 * Must be called only after authenticating the request; authority callback must
 * be the current PEOS decision, not an application/UI role assertion.
 */
export async function allocateVerifiedSchoolPayment(
  pool: Pool, input: AllocationInput, authorize: Authority,
) {
  const requested = minorUnits(input.amountMinor);
  if (requested === 0n) throw new SchoolFinanceError("INVALID_ALLOCATION_AMOUNT");
  const decision = await authorize(input.schoolId, "finance.transactions.record");
  if (decision.schoolId !== input.schoolId || decision.personId !== input.actorPersonId)
    throw new SchoolFinanceError("FINANCE_FORBIDDEN");
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query<{id:string;currency:string}>(
      "SELECT id,currency FROM school_finance.accounts WHERE id=$1 AND peos_school_id=$2 AND status='ACTIVE' FOR UPDATE",
      [input.accountId,input.schoolId],
    );
    if (!account.rows[0] || account.rows[0].currency !== "ZAR")
      throw new SchoolFinanceError("FINANCE_ACCOUNT_UNAVAILABLE");
    const payment = await client.query<{amount_minor:string;verification:string}>(
      "SELECT amount_minor::text,verification FROM school_finance.payments WHERE id=$1 AND account_id=$2 FOR UPDATE",
      [input.paymentId,input.accountId],
    );
    const invoice = await client.query<{amount_minor:string;status:string}>(
      "SELECT amount_minor::text,status FROM school_finance.invoices WHERE id=$1 AND account_id=$2 FOR UPDATE",
      [input.invoiceId,input.accountId],
    );
    if (!payment.rows[0] || !invoice.rows[0]) throw new SchoolFinanceError("FINANCE_RECORD_NOT_FOUND");
    const sums = await client.query<{payment_allocated:string;invoice_allocated:string}>(
      `SELECT
        (SELECT COALESCE(SUM(amount_minor),0)::text FROM school_finance.allocations WHERE payment_id=$1 AND account_id=$3) AS payment_allocated,
        (SELECT COALESCE(SUM(amount_minor),0)::text FROM school_finance.allocations WHERE invoice_id=$2 AND account_id=$3) AS invoice_allocated`,
      [input.paymentId,input.invoiceId,input.accountId],
    );
    const p=payment.rows[0],i=invoice.rows[0],s=sums.rows[0];
    const available=BigInt(p.amount_minor)-BigInt(s.payment_allocated);
    const outstanding=BigInt(i.amount_minor)-BigInt(s.invoice_allocated);
    if (available<0n || outstanding<0n) throw new SchoolFinanceError("INCONSISTENT_BALANCE");
    const plan=planVerifiedAllocation(
      {schoolId:input.schoolId,accountId:input.accountId,currency:"ZAR",verification:p.verification as "REPORTED"|"VERIFIED"|"REJECTED",amountMinor:p.amount_minor,availableMinor:available.toString()},
      {schoolId:input.schoolId,accountId:input.accountId,currency:"ZAR",status:i.status as "ISSUED"|"DISPUTED"|"VOID",totalMinor:i.amount_minor,outstandingMinor:outstanding.toString()},
      input.amountMinor,
    );
    const inserted=await client.query<{id:string}>(
      `INSERT INTO school_finance.allocations(account_id,payment_id,invoice_id,amount_minor,allocated_by_peos_person_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [input.accountId,input.paymentId,input.invoiceId,plan.allocatedMinor,input.actorPersonId],
    );
    await client.query(
      `INSERT INTO school_finance.audit_events(account_id,actor_peos_person_id,action,resource_type,resource_id,metadata)
       VALUES ($1,$2,'FINANCE_PAYMENT_ALLOCATED','ALLOCATION',$3,$4::jsonb)`,
      [input.accountId,input.actorPersonId,inserted.rows[0].id,JSON.stringify({paymentId:input.paymentId,invoiceId:input.invoiceId,amountMinor:plan.allocatedMinor})],
    );
    await client.query("COMMIT");
    return {allocationId:inserted.rows[0].id,...plan};
  } catch(error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
