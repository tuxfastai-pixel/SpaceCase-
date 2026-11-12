import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  initializeFinance,
  recordFinance,
  readFinanceWorkspace,
  type FinanceAuthority,
} from "../../domains/school-finance/workspaceService";
import {
  financeCommand,
  type FinanceCommand,
} from "../../domains/school-finance/workspaceContracts";
import { allocateVerifiedSchoolPayment } from "../../domains/school-finance/allocationService";
import {
  createSchoolReconciliation,
  submitSchoolReconciliation,
  reviewSchoolReconciliation,
} from "../../domains/school-finance/reconciliationService";
import { FinanceAuthorizationError } from "../../platform/finance/peosAuthorization";
import { SchoolFinanceError } from "../../domains/school-finance/money";

test(
  "school finance lifecycle preserves precision, independent review, tenant boundaries and snapshot history",
  { timeout: 60000 },
  async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("Requires isolated PostgreSQL");
      return;
    }
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 6,
    });
    const schoolId = randomUUID(),
      actor = randomUUID(),
      principal = randomUUID(),
      learner = randomUUID();
    let accountId = "";
    const authorize: FinanceAuthority = async (school, action) => ({
      schoolId: school,
      personId: [
        "finance.policy.manage",
        "finance.payments.verify",
        "finance.expenditure.approve",
        "finance.reconciliation.approve",
      ].includes(action)
        ? principal
        : actor,
    });
    const cmd = (input: Record<string, unknown>) =>
      financeCommand.parse({ schoolId, accountId, ...input });
    const record = (input: Record<string, unknown>, person = actor) =>
      recordFinance(
        pool,
        cmd(input) as Extract<
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
        >,
        person,
        authorize,
        learner,
      );
    try {
      // A valid finance authority alone cannot create a school workspace.
      const unprovisionedSchool = randomUUID();
      const principalAuthority: FinanceAuthority = async (school) => ({
        schoolId: school,
        personId: principal,
      });
      await assert.rejects(
        initializeFinance(pool, unprovisionedSchool, principal, principalAuthority),
      );
      assert.equal(
        (await pool.query(
          "SELECT count(*)::int AS n FROM school_finance.accounts WHERE peos_school_id=$1",
          [unprovisionedSchool],
        )).rows[0].n,
        0,
      );
      // The school bootstrap owns workspace provisioning; finance must not bypass it.
      await pool.query("INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1) ON CONFLICT DO NOTHING", [schoolId]);
      accountId = (
        await initializeFinance(pool, schoolId, principal, authorize)
      ).accountId;
      assert.equal(
        (await initializeFinance(pool, schoolId, principal, authorize))
          .accountId,
        accountId,
      );
      await assert.rejects(
        initializeFinance(pool, schoolId, actor, authorize),
        /FINANCE_FORBIDDEN/,
      );
      const invoice = await record({
        command: "INVOICE",
        learnerReference: "SYNTHETIC-1",
        confirmedLearnerId: learner,
        invoiceNumber: "FEE-1",
        category: "SCHOOL_FEES",
        lines: [
          { description: "School fee", quantity: 1, unitPriceMinor: "10001" },
        ],
        instalments: [
          { dueDate: "2027-01-31", amountMinor: "5001" },
          { dueDate: "2027-02-28", amountMinor: "5000" },
        ],
      });
      await assert.rejects(
        record({
          command: "INVOICE",
          learnerReference: "SYNTHETIC-1",
          confirmedLearnerId: learner,
          invoiceNumber: "BAD",
          category: "SCHOOL_FEES",
          lines: [{ description: "Fee", quantity: 1, unitPriceMinor: "100" }],
          instalments: [{ dueDate: "2027-01-31", amountMinor: "99" }],
        }),
        /INVALID_INSTALMENT_SCHEDULE/,
      );
      const payment = await record({
        command: "PAYMENT",
        reference: "PAY-1",
        amountMinor: "10001",
        method: "EFT",
      });
      const scope = { schoolId, accountId, actorPersonId: actor },
        allocation = {
          ...scope,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amountMinor: "10001",
        };
      await assert.rejects(
        allocateVerifiedSchoolPayment(pool, allocation, authorize),
        /VERIFIED_PAYMENT_REQUIRED/,
      );
      const selfAuthority: FinanceAuthority = async (school) => ({
        schoolId: school,
        personId: actor,
      });
      await assert.rejects(
        recordFinance(
          pool,
          cmd({
            command: "VERIFY_PAYMENT",
            paymentId: payment.id,
            decision: "VERIFIED",
            evidenceReference: "PRIVATE-1",
            reason: "Checked bank reference",
          }) as Extract<FinanceCommand, { command: "VERIFY_PAYMENT" }>,
          actor,
          selfAuthority,
        ),
        /PAYMENT_NOT_REVIEWABLE/,
      );
      await record(
        {
          command: "VERIFY_PAYMENT",
          paymentId: payment.id,
          decision: "VERIFIED",
          evidenceReference: "PRIVATE-1",
          reason: "Independently checked reference",
        },
        principal,
      );
      await assert.rejects(
        record(
          {
            command: "VERIFY_PAYMENT",
            paymentId: payment.id,
            decision: "REJECTED",
            evidenceReference: "PRIVATE-1",
            reason: "Duplicate review",
          },
          principal,
        ),
        /PAYMENT_NOT_REVIEWABLE/,
      );
      await allocateVerifiedSchoolPayment(pool, allocation, authorize);
      await assert.rejects(
        allocateVerifiedSchoolPayment(
          pool,
          { ...allocation, schoolId: randomUUID() },
          authorize,
        ),
        /FINANCE_ACCOUNT_UNAVAILABLE/,
      );
      const budget = await record({
        command: "BUDGET",
        academicYear: 2027,
        category: "WATER",
        amountMinor: "10000",
      });
      await assert.rejects(
        recordFinance(
          pool,
          cmd({
            command: "REVIEW_BUDGET",
            reason: "Checked annual budget",
            resourceId: budget.id,
            decision: "APPROVED",
          }) as Extract<FinanceCommand, { command: "REVIEW_BUDGET" }>,
          actor,
          selfAuthority,
        ),
        /FINANCE_RECORD_NOT_REVIEWABLE/,
      );
      await record(
        {
          command: "REVIEW_BUDGET",
            reason: "Checked annual budget",
          resourceId: budget.id,
          decision: "APPROVED",
        },
        principal,
      );
      const expenses = await Promise.all(
        ["EXP-1", "EXP-2"].map((reference) =>
          record({
            command: "EXPENSE",
            budgetId: budget.id,
            reference,
            description: "Water bill",
            amountMinor: "7000",
            evidenceReference: "PRIVATE-BILL",
          }),
        ),
      );
      await assert.rejects(recordFinance(pool, cmd({
        command: "REVIEW_EXPENSE", resourceId: expenses[0].id,
        decision: "APPROVED", reason: "Dual permission self-review",
      }) as Extract<FinanceCommand, {command: "REVIEW_EXPENSE"}>, actor, selfAuthority), /FINANCE_RECORD_NOT_REVIEWABLE/);
      const reviews = await Promise.allSettled(
        expenses.map((expense) =>
          record(
            {
              command: "REVIEW_EXPENSE",
              reason: "Checked supporting bill",
              resourceId: expense.id,
              decision: "APPROVED",
            },
            principal,
          ),
        ),
      );
      assert.equal(reviews.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(reviews.filter((r) => r.status === "rejected").length, 1);
      const expenseAudit = await pool.query(
        "SELECT actor_peos_person_id,metadata FROM school_finance.audit_events WHERE account_id=$1 AND action='FINANCE_EXPENSE_REVIEWED'", [accountId]);
      assert.equal(expenseAudit.rowCount, 1);
      assert.equal(expenseAudit.rows[0].actor_peos_person_id, principal);
      assert.deepEqual(expenseAudit.rows[0].metadata, {decision: "APPROVED", reason: "Checked supporting bill"});
      const period = {
        ...scope,
        periodStart: "2020-01-01",
        periodEnd: "2199-12-31",
      };
      const reconciliation = await createSchoolReconciliation(
        pool,
        period,
        authorize,
      );
      await assert.rejects(
        createSchoolReconciliation(pool, period, authorize),
        /RECONCILIATION_ALREADY_EXISTS/,
      );
      await submitSchoolReconciliation(
        pool,
        { ...scope, ...reconciliation, evidenceReference: "PRIVATE-RECON-1" },
        authorize,
      );
      await record({
        command: "PAYMENT",
        reference: "LATE",
        amountMinor: "1",
        method: "CASH",
      });
      await assert.rejects(
        reviewSchoolReconciliation(
          pool,
          {
            ...scope,
            actorPersonId: principal,
            ...reconciliation,
            decision: "APPROVED",
            reason: "Checked",
          },
          authorize,
        ),
        /RECONCILIATION_LEDGER_CHANGED/,
      );
      await reviewSchoolReconciliation(
        pool,
        {
          ...scope,
          actorPersonId: principal,
          ...reconciliation,
          decision: "REJECTED",
          reason: "New record requires revision",
        },
        authorize,
      );
      await createSchoolReconciliation(pool, period, authorize);
      await submitSchoolReconciliation(
        pool,
        { ...scope, ...reconciliation, evidenceReference: "PRIVATE-RECON-2" },
        authorize,
      );
      await reviewSchoolReconciliation(
        pool,
        {
          ...scope,
          actorPersonId: principal,
          ...reconciliation,
          decision: "APPROVED",
          reason: "Checked revised snapshot",
        },
        authorize,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT COUNT(*)::int n FROM school_finance.reconciliation_versions WHERE account_id=$1",
            [accountId],
          )
        ).rows[0].n,
        2,
      );
      const read = await readFinanceWorkspace(
        pool,
        schoolId,
        actor,
        selfAuthority,
      );
      assert.equal(read.totals?.invoicedMinor, "10001");
      assert.equal(read.totals?.allocatedMinor, "10001");
      assert.equal(read.totals?.approvedExpensesMinor, "7000");
      assert.equal(read.invoices?.[0].instalments.length, 2);
      const visibleReview = read.audit?.find(row => row.action === "FINANCE_EXPENSE_REVIEWED");
      assert.equal(visibleReview?.actorPersonId, principal);
      assert.equal(visibleReview?.decision, "APPROVED");
      assert.equal(visibleReview?.reason, "Checked supporting bill");
      const officer: FinanceAuthority = async (school, action) => {
        if (
          action === "finance.audit.read" ||
          action === "finance.summary.read"
        )
          throw new FinanceAuthorizationError(403, "FINANCE_FORBIDDEN");
        return { schoolId: school, personId: actor };
      };
      const restricted = await readFinanceWorkspace(
        pool,
        schoolId,
        actor,
        officer,
      );
      assert.equal(restricted.totals, null);
      assert.equal(restricted.audit, null);
      // Domain-level denial is equivalent to HTTP 403 for optional projections.
      const domainDenied: FinanceAuthority = async (school, action) => {
        if (action === "finance.summary.read" || action === "finance.audit.read")
          throw new SchoolFinanceError("FINANCE_FORBIDDEN");
        return { schoolId: school, personId: actor };
      };
      const domainRestricted = await readFinanceWorkspace(pool, schoolId, actor, domainDenied);
      assert.equal(domainRestricted.totals, null);
      assert.equal(domainRestricted.audit, null);
      // A PEOS outage or unexpected authorization error must fail closed,
      // never masquerade as a permitted transaction-only view.
      const brokenAuthority: FinanceAuthority = async (school, action) => {
        if (action === "finance.summary.read") throw new Error("PEOS_UNAVAILABLE");
        return { schoolId: school, personId: actor };
      };
      await assert.rejects(
        readFinanceWorkspace(pool, schoolId, actor, brokenAuthority),
        /PEOS_UNAVAILABLE/,
      );
      await assert.rejects(
        readFinanceWorkspace(pool, schoolId, principal, officer),
        /FINANCE_FORBIDDEN/,
      );
      const failureTrigger =
        "finance_audit_" + randomUUID().replaceAll("-", "");
      await pool.query(
        `CREATE FUNCTION public.${failureTrigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.account_id='${accountId}'::uuid AND NEW.action IN ('FINANCE_PAYMENT_REPORTED','FINANCE_EXPENSE_REVIEWED') THEN RAISE EXCEPTION 'synthetic audit outage'; END IF; RETURN NEW; END $$`,
      );
      try {
        await pool.query(
          `CREATE TRIGGER ${failureTrigger} BEFORE INSERT ON school_finance.audit_events FOR EACH ROW EXECUTE FUNCTION public.${failureTrigger}()`,
        );
        const pendingExpense = (await pool.query(
          "SELECT id FROM school_finance.expenses WHERE account_id=$1 AND status='SUBMITTED'", [accountId])).rows[0].id;
        await assert.rejects(record({command: "REVIEW_EXPENSE", resourceId: pendingExpense,
          decision: "REJECTED", reason: "Evidence requires correction"}, principal), /synthetic audit outage/);
        assert.deepEqual((await pool.query(
          "SELECT status,reviewed_by_peos_person_id,reviewed_at FROM school_finance.expenses WHERE id=$1", [pendingExpense])).rows[0],
          {status: "SUBMITTED", reviewed_by_peos_person_id: null, reviewed_at: null});
        assert.equal((await pool.query(
          "SELECT count(*)::int n FROM school_finance.audit_events WHERE account_id=$1 AND resource_id=$2 AND action='FINANCE_EXPENSE_REVIEWED'", [accountId, pendingExpense])).rows[0].n, 0);
        await assert.rejects(
          record({
            command: "PAYMENT",
            reference: "AUDIT-FAILURE",
            amountMinor: "100",
            method: "CASH",
          }),
          /synthetic audit outage/,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT COUNT(*)::int count FROM school_finance.payments WHERE account_id=$1 AND external_reference='AUDIT-FAILURE'",
              [accountId],
            )
          ).rows[0].count,
          0,
        );
      } finally {
        await pool.query(
          `DROP TRIGGER IF EXISTS ${failureTrigger} ON school_finance.audit_events`,
        );
        await pool.query(`DROP FUNCTION IF EXISTS public.${failureTrigger}()`);
      }
      const role = await pool.query(
        "SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime'",
      );
      if (role.rowCount) {
        // Exercise actual finance initialization using the restricted application role.
        // A pre-provisioned school must not require INSERT access to school_ops.
        const runtime = await pool.connect();
        try {
          await runtime.query("SET ROLE spacecase_runtime");
          const runtimeRights = await runtime.query(
            "SELECT has_schema_privilege(current_user,'school_ops','USAGE') AS schema_usage",
          );
          assert.equal(runtimeRights.rows[0].schema_usage, false);
          // Restricted runtime must not create school records even if it knows a PEOS ID.
          await assert.rejects(
            runtime.query(
              "INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)",
              [randomUUID()],
            ),
            /permission denied/,
          );
          const initialized = await initializeFinance(
            { connect: async () => ({
              query: (sql: string, params?: unknown[]) => runtime.query(sql, params),
              release: () => {},
            }) } as unknown as Pool,
            schoolId,
            principal,
            authorize,
          );
          assert.equal(initialized.accountId, accountId);
          // Exercise allocation's real read path with the restricted runtime role.
          // This invoice is already fully allocated, so the domain denial must be
          // reached without requiring any invoice UPDATE privilege for row locks.
          await assert.rejects(allocateVerifiedSchoolPayment(
            {connect: async () => ({query: (sql: string, params?: unknown[]) => runtime.query(sql, params), release: () => {}})} as unknown as Pool,
            {...allocation, amountMinor: "1"}, authorize,
          ), /INVALID_ALLOCATION_AMOUNT/);
        } finally {
          await runtime.query("RESET ROLE");
          runtime.release();
        }
        const rights = await pool.query(
          "SELECT has_column_privilege('spacecase_runtime','school_finance.payments','amount_minor','UPDATE') amount,has_table_privilege('spacecase_runtime','school_finance.audit_events','DELETE') deletion,has_table_privilege('spacecase_runtime','school_finance.reconciliation_versions','UPDATE') versions",
        );
        assert.deepEqual(rights.rows[0], {
          amount: false,
          deletion: false,
          versions: false,
        });
      }
    } finally {
      if (accountId) {
        for (const table of [
          "audit_events",
          "reconciliation_versions",
          "reconciliations",
          "allocations",
          "invoice_lines",
          "instalments",
          "invoices",
          "payments",
          "expenses",
          "budgets",
        ])
          await pool.query(
            `DELETE FROM school_finance.${table} WHERE account_id=$1`,
            [accountId],
          );
        await pool.query("DELETE FROM school_finance.accounts WHERE id=$1", [
          accountId,
        ]);
        await pool.query(
          "DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",
          [schoolId],
        );
      }
      await pool.end();
    }
  },
);
