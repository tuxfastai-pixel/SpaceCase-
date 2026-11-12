import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { SchoolFinanceError, invoiceTotal, minorUnits } from "./money";
import type { FinanceAction } from "../../platform/finance/peosAuthorization";
import { financeReviewReason } from "./workspaceContracts";
import type { FinanceCommand } from "./workspaceContracts";
export type FinanceAuthority = (
  schoolId: string,
  action: FinanceAction,
) => Promise<{ schoolId: string; personId: string }>;
export type FinanceScope = {
  schoolId: string;
  accountId: string;
  actorPersonId: string;
};
export async function financeTransaction<T>(
  pool: Pool,
  run: (db: PoolClient) => Promise<T>,
) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await run(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function financeAuthority(
  scope: { schoolId: string; actorPersonId: string },
  action: FinanceAction,
  authorize: FinanceAuthority,
) {
  const decision = await authorize(scope.schoolId, action);
  if (
    decision.schoolId !== scope.schoolId ||
    decision.personId !== scope.actorPersonId
  )
    throw new SchoolFinanceError("FINANCE_FORBIDDEN");
}
export async function lockFinanceAccount(db: PoolClient, scope: FinanceScope) {
  const result = await db.query(
    "SELECT id FROM school_finance.accounts WHERE id=$1 AND peos_school_id=$2 AND status='ACTIVE' FOR UPDATE",
    [scope.accountId, scope.schoolId],
  );
  if (result.rowCount !== 1)
    throw new SchoolFinanceError("FINANCE_ACCOUNT_UNAVAILABLE");
}
export async function financeAudit(
  db: PoolClient,
  scope: FinanceScope,
  action: string,
  type: string,
  id: string,
  metadata: unknown = {},
) {
  await db.query(
    `INSERT INTO school_finance.audit_events(account_id,actor_peos_person_id,action,resource_type,resource_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      scope.accountId,
      scope.actorPersonId,
      action,
      type,
      id,
      JSON.stringify(metadata),
    ],
  );
}
export async function initializeFinance(
  pool: Pool,
  schoolId: string,
  actorPersonId: string,
  authorize: FinanceAuthority,
) {
  await financeAuthority(
    { schoolId, actorPersonId },
    "finance.policy.manage",
    authorize,
  );
  return financeTransaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "finance:" + schoolId,
    ]);
    const existing = await db.query<{ id: string; status: string }>(
      "SELECT id,status FROM school_finance.accounts WHERE peos_school_id=$1",
      [schoolId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].status !== "ACTIVE")
        throw new SchoolFinanceError("FINANCE_ACCOUNT_UNAVAILABLE");
      return { accountId: existing.rows[0].id };
    }
    // Finance initialization must not write to school_ops with the restricted runtime role.
    // The school workspace is provisioned through the existing privileged school setup path.
    const id = randomUUID(),
      scope = { schoolId, accountId: id, actorPersonId };
    await db.query(
      "INSERT INTO school_finance.accounts(id,peos_school_id,status) VALUES($1,$2,'ACTIVE')",
      [id, schoolId],
    );
    await financeAudit(db, scope, "FINANCE_ACCOUNT_INITIALIZED", "ACCOUNT", id);
    return { accountId: id };
  });
}
type RecordCommand = Extract<
  FinanceCommand,
  {
    command:
      | "INVOICE"
      | "PAYMENT"
      | "VERIFY_PAYMENT"
      | "BUDGET"
      | "EXPENSE"
      | "REVIEW_BUDGET"
      | "REVIEW_EXPENSE";
  }
>;
export async function recordFinance(
  pool: Pool,
  input: RecordCommand,
  actorPersonId: string,
  authorize: FinanceAuthority,
  learnerId?: string,
) {
  const scope = { ...input, actorPersonId };
  const action: FinanceAction =
    input.command === "VERIFY_PAYMENT"
      ? "finance.payments.verify"
      : input.command.startsWith("REVIEW_")
        ? "finance.expenditure.approve"
        : "finance.transactions.record";
  await financeAuthority(scope, action, authorize);
  if (input.command === "REVIEW_BUDGET" || input.command === "REVIEW_EXPENSE") {
    if (!financeReviewReason.safeParse(input.reason).success)
      throw new SchoolFinanceError("FINANCE_REVIEW_REASON_REQUIRED");
  }
  return financeTransaction(pool, async (db) => {
    await lockFinanceAccount(db, scope);
    const id = randomUUID();
    if (input.command === "INVOICE") {
      if (!learnerId)
        throw new SchoolFinanceError("FINANCE_LEARNER_UNAVAILABLE");
      const total = invoiceTotal(input.lines),
        sum = input.instalments.reduce(
          (n, row) => n + minorUnits(row.amountMinor),
          0n,
        );
      if (
        sum !== BigInt(total) ||
        input.instalments.some(
          (row, i) => i > 0 && row.dueDate <= input.instalments[i - 1].dueDate,
        )
      )
        throw new SchoolFinanceError("INVALID_INSTALMENT_SCHEDULE");
      await db.query(
        `INSERT INTO school_finance.invoices(id,account_id,peos_learner_id,invoice_number,amount_minor,due_date,created_by_peos_person_id,category,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id,
          input.accountId,
          learnerId,
          input.invoiceNumber,
          total,
          input.instalments.at(-1)!.dueDate,
          actorPersonId,
          input.category,
          input.lines
            .map((l) => l.description)
            .join("; ")
            .slice(0, 300),
        ],
      );
      for (const line of input.lines)
        await db.query(
          "INSERT INTO school_finance.invoice_lines(account_id,invoice_id,description,quantity,unit_price_minor) VALUES($1,$2,$3,$4,$5)",
          [
            input.accountId,
            id,
            line.description,
            line.quantity,
            line.unitPriceMinor,
          ],
        );
      for (const [i, row] of input.instalments.entries())
        await db.query(
          "INSERT INTO school_finance.instalments(account_id,invoice_id,sequence,due_date,amount_minor) VALUES($1,$2,$3,$4,$5)",
          [input.accountId, id, i + 1, row.dueDate, row.amountMinor],
        );
      await financeAudit(db, scope, "FINANCE_INVOICE_ISSUED", "INVOICE", id, {
        amountMinor: total,
        instalments: input.instalments.length,
      });
    } else if (input.command === "PAYMENT") {
      await db.query(
        `INSERT INTO school_finance.payments(id,account_id,external_reference,amount_minor,recorded_by_peos_person_id,method) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          id,
          input.accountId,
          input.reference,
          input.amountMinor,
          actorPersonId,
          input.method,
        ],
      );
      await financeAudit(db, scope, "FINANCE_PAYMENT_REPORTED", "PAYMENT", id, {
        amountMinor: input.amountMinor,
      });
    } else if (input.command === "VERIFY_PAYMENT") {
      const result = await db.query(
        `UPDATE school_finance.payments SET verification=$4,verification_evidence_ref=$5,verified_by_peos_person_id=$3,verified_at=now(),review_reason=$6 WHERE id=$1 AND account_id=$2 AND verification='REPORTED' AND recorded_by_peos_person_id<>$3 RETURNING id`,
        [
          input.paymentId,
          input.accountId,
          actorPersonId,
          input.decision,
          input.evidenceReference,
          input.reason,
        ],
      );
      if (result.rowCount !== 1)
        throw new SchoolFinanceError("PAYMENT_NOT_REVIEWABLE");
      await financeAudit(
        db,
        scope,
        "FINANCE_PAYMENT_REVIEWED",
        "PAYMENT",
        input.paymentId,
        { decision: input.decision },
      );
      return { id: input.paymentId };
    } else if (input.command === "BUDGET") {
      await db.query(
        `INSERT INTO school_finance.budgets(id,account_id,academic_year,category,amount_minor,prepared_by_peos_person_id) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          id,
          input.accountId,
          input.academicYear,
          input.category,
          input.amountMinor,
          actorPersonId,
        ],
      );
      await financeAudit(db, scope, "FINANCE_BUDGET_PREPARED", "BUDGET", id);
    } else if (input.command === "EXPENSE") {
      const budget = await db.query(
        "SELECT id FROM school_finance.budgets WHERE id=$1 AND account_id=$2 AND status='APPROVED'",
        [input.budgetId, input.accountId],
      );
      if (!budget.rowCount)
        throw new SchoolFinanceError("APPROVED_BUDGET_REQUIRED");
      await db.query(
        `INSERT INTO school_finance.expenses(id,account_id,budget_id,external_reference,description,amount_minor,evidence_reference,prepared_by_peos_person_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          input.accountId,
          input.budgetId,
          input.reference,
          input.description,
          input.amountMinor,
          input.evidenceReference,
          actorPersonId,
        ],
      );
      await financeAudit(db, scope, "FINANCE_EXPENSE_SUBMITTED", "EXPENSE", id);
    } else {
      const budgetReview = input.command === "REVIEW_BUDGET";
      // Table names are selected from a fixed branch, never request data.
      const table = budgetReview ? "budgets" : "expenses",
        pending = budgetReview ? "DRAFT" : "SUBMITTED";
      if (!budgetReview && input.decision === "APPROVED") {
        const balance = await db.query<{ amount_minor: string; used: string }>(
          `SELECT b.amount_minor::text,(SELECT COALESCE(SUM(e.amount_minor),0)::text FROM school_finance.expenses e WHERE e.budget_id=b.id AND e.account_id=b.account_id AND e.status='APPROVED') used FROM school_finance.budgets b JOIN school_finance.expenses e ON e.budget_id=b.id AND e.account_id=b.account_id WHERE e.id=$1 AND e.account_id=$2 AND b.status='APPROVED'`,
          [input.resourceId, input.accountId],
        );
        const expense = await db.query<{ amount_minor: string }>(
          "SELECT amount_minor::text FROM school_finance.expenses WHERE id=$1 AND account_id=$2",
          [input.resourceId, input.accountId],
        );
        if (
          !balance.rows[0] ||
          !expense.rows[0] ||
          BigInt(balance.rows[0].used) + BigInt(expense.rows[0].amount_minor) >
            BigInt(balance.rows[0].amount_minor)
        )
          throw new SchoolFinanceError("BUDGET_EXCEEDED");
      }
      const result = await db.query(
        `UPDATE school_finance.${table} SET status=$4,reviewed_by_peos_person_id=$3,reviewed_at=now() WHERE id=$1 AND account_id=$2 AND status=$5 AND prepared_by_peos_person_id<>$3 RETURNING id`,
        [
          input.resourceId,
          input.accountId,
          actorPersonId,
          input.decision,
          pending,
        ],
      );
      if (result.rowCount !== 1)
        throw new SchoolFinanceError("FINANCE_RECORD_NOT_REVIEWABLE");
      await financeAudit(
        db,
        scope,
        budgetReview ? "FINANCE_BUDGET_REVIEWED" : "FINANCE_EXPENSE_REVIEWED",
        budgetReview ? "BUDGET" : "EXPENSE",
        input.resourceId,
        { decision: input.decision, reason: input.reason.trim() },
      );
      return { id: input.resourceId };
    }
    return { id };
  });
}

export async function readFinanceWorkspace(
  pool: Pool,
  schoolId: string,
  actorPersonId: string,
  authorize: FinanceAuthority,
) {
  await financeAuthority(
    { schoolId, actorPersonId },
    "finance.transactions.read",
    authorize,
  );
  let summaryAllowed = false,
    auditAllowed = false;
  for (const permission of [
    "finance.summary.read",
    "finance.audit.read",
  ] as const) {
    try {
      await financeAuthority(
        { schoolId, actorPersonId },
        permission,
        authorize,
      );
      if (permission === "finance.summary.read") summaryAllowed = true;
      else auditAllowed = true;
    } catch (error) {
      // financeAuthority rejects mismatched or denied PEOS identities with
      // SchoolFinanceError("FINANCE_FORBIDDEN"), which has no HTTP status.
      // Only suppress an explicit permission denial for optional projections.
      if (
        !(error instanceof SchoolFinanceError && error.message === "FINANCE_FORBIDDEN") &&
        (error as { status?: number }).status !== 403
      ) throw error;
    }
  }
  return financeTransaction(pool, async (db) => {
    // A consistent ledger projection; concurrent mutations serialize on the same account lock.
    const accounts = await db.query<{ id: string; status: string }>(
      "SELECT id,status FROM school_finance.accounts WHERE peos_school_id=$1 FOR UPDATE",
      [schoolId],
    );
    const account = accounts.rows[0];
    if (!account) return { account: null };
    if (account.status !== "ACTIVE")
      throw new SchoolFinanceError("FINANCE_ACCOUNT_UNAVAILABLE");
    const params = [account.id];
    const invoices = await db.query(
      `SELECT i.id,i.invoice_number AS "invoiceNumber",i.peos_learner_id AS "learnerId",i.description,i.category,i.amount_minor::text AS "amountMinor",i.due_date::text AS "dueDate",i.status,(SELECT COALESCE(jsonb_agg(jsonb_build_object('sequence',s.sequence,'dueDate',s.due_date::text,'amountMinor',s.amount_minor::text) ORDER BY s.sequence),'[]'::jsonb) FROM school_finance.instalments s WHERE s.invoice_id=i.id AND s.account_id=i.account_id) AS instalments,COALESCE((SELECT SUM(a.amount_minor) FROM school_finance.allocations a WHERE a.invoice_id=i.id AND a.account_id=i.account_id),0)::text AS "allocatedMinor" FROM school_finance.invoices i WHERE account_id=$1 ORDER BY created_at DESC,id LIMIT 101`,
      params,
    );
    const payments = await db.query(
      `SELECT p.id,p.external_reference AS reference,p.amount_minor::text AS "amountMinor",p.verification,p.method,p.recorded_by_peos_person_id AS "preparedBy",p.verification_evidence_ref AS "evidenceReference",COALESCE((SELECT SUM(a.amount_minor) FROM school_finance.allocations a WHERE a.payment_id=p.id AND a.account_id=p.account_id),0)::text AS "allocatedMinor" FROM school_finance.payments p WHERE account_id=$1 ORDER BY recorded_at DESC,id LIMIT 101`,
      params,
    );
    const budgets = await db.query(
      `SELECT b.id,b.academic_year AS year,b.category,b.amount_minor::text AS "amountMinor",b.status,b.prepared_by_peos_person_id AS "preparedBy",COALESCE((SELECT SUM(e.amount_minor) FROM school_finance.expenses e WHERE e.budget_id=b.id AND e.account_id=b.account_id AND e.status='APPROVED'),0)::text AS "approvedMinor" FROM school_finance.budgets b WHERE account_id=$1 ORDER BY academic_year DESC,category,id LIMIT 101`,
      params,
    );
    const expenses = await db.query(
      `SELECT id,budget_id AS "budgetId",external_reference AS reference,description,amount_minor::text AS "amountMinor",status,prepared_by_peos_person_id AS "preparedBy",evidence_reference AS "evidenceReference" FROM school_finance.expenses WHERE account_id=$1 ORDER BY created_at DESC,id LIMIT 101`,
      params,
    );
    const reconciliations = await db.query(
      `SELECT id,period_start::text AS "periodStart",period_end::text AS "periodEnd",status,prepared_by_peos_person_id AS "preparedBy",evidence_reference AS "evidenceReference",ledger_snapshot AS snapshot,review_reason AS "reviewReason",revision FROM school_finance.reconciliations WHERE account_id=$1 ORDER BY created_at DESC,id LIMIT 101`,
      params,
    );
    const totals = await db.query(
      `SELECT
   (SELECT COALESCE(SUM(amount_minor),0)::text FROM school_finance.invoices WHERE account_id=$1 AND status='ISSUED') AS "invoicedMinor",
   (SELECT COALESCE(SUM(amount_minor),0)::text FROM school_finance.payments WHERE account_id=$1 AND verification='VERIFIED') AS "verifiedMinor",
   (SELECT COALESCE(SUM(amount_minor),0)::text FROM school_finance.payments WHERE account_id=$1 AND verification='REPORTED') AS "reportedMinor",
   (SELECT COALESCE(SUM(amount_minor),0)::text FROM school_finance.allocations WHERE account_id=$1) AS "allocatedMinor",
   (SELECT COALESCE(SUM(amount_minor),0)::text FROM school_finance.expenses WHERE account_id=$1 AND status='APPROVED') AS "approvedExpensesMinor"`,
      params,
    );
    const scope = { schoolId, accountId: account.id, actorPersonId };
    await financeAudit(
      db,
      scope,
      "FINANCE_WORKSPACE_READ",
      "ACCOUNT",
      account.id,
    );
    const audit = auditAllowed
      ? await db.query(
          `SELECT action,resource_type AS "resourceType",resource_id AS "resourceId",actor_peos_person_id AS "actorPersonId",metadata->>'decision' AS decision,metadata->>'reason' AS reason,occurred_at::text AS "occurredAt" FROM school_finance.audit_events WHERE account_id=$1 ORDER BY occurred_at DESC,id DESC LIMIT 100`,
          params,
        )
      : null;
    return {
      account,
      totals: summaryAllowed ? totals.rows[0] : null,
      audit: audit?.rows ?? null,
      invoices: invoices.rows.slice(0, 100),
      payments: payments.rows.slice(0, 100),
      budgets: budgets.rows.slice(0, 100),
      expenses: expenses.rows.slice(0, 100),
      reconciliations: reconciliations.rows.slice(0, 100),
      truncated: [invoices, payments, budgets, expenses, reconciliations].some(
        (r) => r.rows.length > 100,
      ),
    };
  });
}
