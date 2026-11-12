"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { z } from "zod";
import { expenseCategories, formatZar, randToMinor } from "./forms";
import type { FinanceAction } from "../../platform/finance/peosAuthorization";
import s from "./finance.module.css";
import InvoiceForm from "./InvoiceForm";
import FinanceStaff from "./FinanceStaff";
type School = { id: string; displayName: string; actions: FinanceAction[] };
const amount = z.string().regex(/^\d+$/),
  record = z.object({ id: z.string().uuid(), amountMinor: amount });
const invoice = record.extend({
  invoiceNumber: z.string(),
  learnerId: z.string(),
  description: z.string(),
  category: z.string(),
  dueDate: z.string(),
  instalments: z.array(
    z.object({
      sequence: z.number(),
      dueDate: z.string(),
      amountMinor: amount,
    }),
  ),
  status: z.string(),
  allocatedMinor: amount,
});
const payment = record.extend({
  reference: z.string(),
  verification: z.string(),
  method: z.string(),
  preparedBy: z.string(),
  allocatedMinor: amount,
  evidenceReference: z.string().nullable(),
});
const budget = record.extend({
  year: z.number(),
  category: z.string(),
  status: z.string(),
  preparedBy: z.string(),
  approvedMinor: amount,
});
const expense = record.extend({
  budgetId: z.string(),
  reference: z.string(),
  description: z.string(),
  status: z.string(),
  preparedBy: z.string(),
  evidenceReference: z.string(),
});
const reconciliation = z.object({
  id: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: z.string(),
  preparedBy: z.string(),
  evidenceReference: z.string().nullable(),
  snapshot: z
    .object({
      recordCount: z.string(),
      invoicedMinor: amount,
      verifiedMinor: amount,
      allocatedMinor: amount,
      approvedExpensesMinor: amount,
    })
    .passthrough()
    .nullable(),
  reviewReason: z.string().nullable(),
  revision: z.number(),
});
const workspace = z.object({
  account: z.object({ id: z.string(), status: z.string() }).nullable(),
  personId: z.string(),
  totals: z
    .object({
      invoicedMinor: amount,
      verifiedMinor: amount,
      reportedMinor: amount,
      allocatedMinor: amount,
      approvedExpensesMinor: amount,
    })
    .nullable()
    .optional(),
  invoices: z.array(invoice).optional(),
  payments: z.array(payment).optional(),
  budgets: z.array(budget).optional(),
  expenses: z.array(expense).optional(),
  reconciliations: z.array(reconciliation).optional(),
  audit: z
    .array(
      z.object({
        action: z.string(),
        resourceType: z.string(),
        resourceId: z.string(),
        occurredAt: z.string(),
        actorPersonId: z.string(),
        decision: z.string().nullable(),
        reason: z.string().nullable(),
      }),
    )
    .nullable()
    .optional(),
  truncated: z.boolean().optional(),
});
type Workspace = z.infer<typeof workspace>;
const errorMessages: Record<string, string> = {
  FINANCE_NOT_ENABLED:
    "School finance is awaiting activation. No records were changed.",
  FINANCE_FORBIDDEN: "Your current school permission could not be confirmed.",
  FINANCE_DUPLICATE_REFERENCE:
    "That reference already exists. Check the existing record before retrying.",
  PAYMENT_NOT_REVIEWABLE:
    "This payment needs a different authorized reviewer and must still be awaiting review.",
  FINANCE_REVIEW_REASON_REQUIRED: "Enter a review reason of up to 500 characters.",
  BUDGET_EXCEEDED: "This expense exceeds the remaining approved budget.",
  FINANCE_RECORD_NOT_REVIEWABLE:
    "This record needs a different authorized reviewer and must still be awaiting review.",
  RECONCILIATION_LEDGER_CHANGED:
    "The period records changed after submission. Reject this version, then ask the preparer to create and submit a new revision.",
  FINANCE_LEARNER_UNAVAILABLE:
    "Check the learner reference. Only a currently enrolled learner in this school can be invoiced.",
  RECONCILIATION_ALREADY_EXISTS:
    "This period already has a draft, submitted or approved reconciliation.",
  RECONCILIATION_NOT_REVIEWABLE:
    "This reconciliation needs a different authorized reviewer and must be submitted first.",
};
function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        maxLength={type === "text" ? 200 : undefined}
      />
    </label>
  );
}
function money(form: FormData, key = "amount") {
  return randToMinor(String(form.get(key) ?? ""));
}
export default function FinanceClient({
  schools,
  initialSchool,
  enabled,
  directoryTruncated,
}: {
  schools: School[];
  initialSchool: string;
  enabled: boolean;
  directoryTruncated: boolean;
}) {
  const [schoolId, setSchoolId] = useState(initialSchool),
    [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [tab, setTab] = useState("accounts");
  const pending = useRef(false);
  const school = schools.find((row) => row.id === schoolId)!,
    can = (action: FinanceAction) => school.actions.includes(action);
  useEffect(() => {
    setData(null);
    setError("");
    setNotice("");
    if (!enabled) return;
    const controller = new AbortController();
    void fetch(`/api/finance/workspace?schoolId=${schoolId}`, {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw Error(
            errorMessages[body.error] ??
              "Finance records could not be loaded. Refresh or check your school access.",
          );
        return workspace.parse(body);
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Finance records could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [schoolId, enabled, refresh]);
  async function save(input: Record<string, unknown>) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/finance/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          schoolId,
          accountId: data?.account?.id,
          ...input,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(
          errorMessages[body.error] ??
            `The record could not be saved (${body.error ?? "service unavailable"}). Check the entries and current access.`,
        );
      setRefresh((v) => v + 1);
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The record could not be saved.",
      );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function submit(
    event: FormEvent<HTMLFormElement>,
    build: (form: FormData) => Record<string, unknown>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      if (await save(build(new FormData(form)))) {
        form.reset();
        setNotice("Saved. Refreshing the school records.");
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Check the form entries.",
      );
    }
  }
  function download() {
    if (!data) return;
    const rows = [
      [
        "School fee records — latest 100 invoices",
        "Learner ID",
        "Category",
        "Description",
        "Due date",
        "Invoiced cents",
        "Allocated cents",
        "Outstanding cents",
      ],
      ...(data.invoices ?? []).map((row) => [
        row.invoiceNumber,
        row.learnerId,
        row.category,
        row.description,
        row.dueDate,
        row.amountMinor,
        row.allocatedMinor,
        (BigInt(row.amountMinor) - BigInt(row.allocatedMinor)).toString(),
      ]),
    ];
    const escape = (value: string) =>
      '"' +
      (/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') +
      '"';
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "school-fee-records.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  const formsDisabled = busy || !data?.account;
  return (
    <main className={s.page}>
      <header className={s.header}>
        <a href="/dashboard">SpaceCase</a>
        <nav aria-label="Workspace">
          <a href={`/principal?school=${schoolId}`}>Principal</a>
          <a href={`/admin?school=${schoolId}`}>Administration</a>
          <a href="/support">Help</a>
        </nav>
        <form action="/auth/logout" method="post">
          <button>Sign out</button>
        </form>
      </header>
      <div className={s.content}>
        <p className={s.eyebrow}>School operations</p>
        <h1>School finance</h1>
        <p>
          Manage school fees, recorded payments, budgets and approvals. Your
          school’s SpaceCase subscription has its own billing records.
        </p>
        <div className={s.toolbar}>
          <label>
            School
            <select
              value={schoolId}
              disabled={busy}
              onChange={(e) => {
                setData(null);
                setError("");
                setSchoolId(e.target.value);
              }}
            >
              {schools.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.displayName}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !enabled}
            onClick={() => setRefresh((v) => v + 1)}
          >
            Refresh records
          </button>
        </div>
        {directoryTruncated && <p>Showing the first 100 authorized schools.</p>}
        {!enabled ? (
          <section className={s.card}>
            <h2>Finance is being prepared</h2>
            <p>
              Recording and approval are awaiting activation after school
              authority and integration checks.
            </p>
          </section>
        ) : (
          <>
            {error && (
              <p role="alert" className={s.error}>
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            {!data && !error && (
              <p role="status">Checking current access and loading records…</p>
            )}
            {data && !data.account && (
              <section className={s.card}>
                <h2>No school finance account yet</h2>
                <p>No totals or transactions have been created.</p>
                {can("finance.policy.manage") ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save({ command: "INITIALIZE", accountId: undefined })
                    }
                  >
                    Set up school finance account
                  </button>
                ) : (
                  <p>The school principal must set up the account first.</p>
                )}
              </section>
            )}
            {data?.account && (
              <>
                <p className={s.note}>
                  Amounts are in rand. A reported payment is not verified money.
                  Evidence references identify your separately held private
                  documents; this screen does not upload or validate those
                  documents.
                </p>
                {data.totals && (
                  <section className={s.metrics} aria-label="School totals">
                    {Object.entries({
                      Invoiced: data.totals.invoicedMinor,
                      "Verified payments": data.totals.verifiedMinor,
                      "Awaiting verification": data.totals.reportedMinor,
                      "Allocated to invoices": data.totals.allocatedMinor,
                      "Approved expenses": data.totals.approvedExpensesMinor,
                    }).map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{formatZar(value)}</strong>
                      </div>
                    ))}
                  </section>
                )}
                <nav className={s.tabs} aria-label="Finance sections">
                  {[
                    ["accounts", "Fees & payments"],
                    ["budgets", "Budgets & expenses"],
                    ["review", "Reconciliation & review"],
                    ...(data.audit ? [["audit", "Audit history"]] : []),
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={tab === key}
                      onClick={() => setTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                {data.truncated && (
                  <p className={s.note}>
                    Lists show the latest 100 records per category. School
                    totals cover the full account. Exports contain the displayed
                    invoices only.
                  </p>
                )}
                {tab === "accounts" && (
                  <>
                    <section className={s.card}>
                      <h2>Fee invoices</h2>
                      <div className={s.toolbar}>
                        <button onClick={download}>
                          Download displayed fee records
                        </button>
                        <button onClick={() => window.print()}>
                          Print displayed records
                        </button>
                      </div>
                      <div className={s.tableWrap}>
                        <table>
                          <caption>Latest fee invoices</caption>
                          <thead>
                            <tr>
                              <th>Invoice / learner</th>
                              <th>Category / description</th>
                              <th>Due</th>
                              <th>Invoiced</th>
                              <th>Allocated</th>
                              <th>Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.invoices?.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  {row.invoiceNumber}
                                  <small>{row.learnerId}</small>
                                </td>
                                <td>
                                  {row.category}
                                  <small>{row.description}</small>
                                </td>
                                <td>
                                  {row.dueDate}
                                  <details>
                                    <summary>Instalments</summary>
                                    {row.instalments.map((part) => (
                                      <small key={part.sequence}>
                                        {part.dueDate} ·{" "}
                                        {formatZar(part.amountMinor)}
                                      </small>
                                    ))}
                                  </details>
                                </td>
                                <td>{formatZar(row.amountMinor)}</td>
                                <td>{formatZar(row.allocatedMinor)}</td>
                                <td>
                                  {formatZar(
                                    (
                                      BigInt(row.amountMinor) -
                                      BigInt(row.allocatedMinor)
                                    ).toString(),
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!data.invoices?.length && <p>No invoices recorded.</p>}
                      </div>
                    </section>
                    {can("finance.transactions.record") && (
                      <InvoiceForm
                        key={schoolId}
                        schoolId={schoolId}
                        disabled={Boolean(formsDisabled)}
                        save={save}
                        onError={setError}
                      />
                    )}
                    <section className={s.card}>
                      <h2>Payments</h2>
                      <p>
                        Receipt references below are internal records. This
                        workspace does not collect money or issue tax invoices.
                      </p>
                      <div className={s.tableWrap}>
                        <table>
                          <caption>Latest reported payments</caption>
                          <thead>
                            <tr>
                              <th>Reference</th>
                              <th>Method</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Available to allocate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.payments?.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  {row.reference}
                                  <small>{row.evidenceReference}</small>
                                </td>
                                <td>{row.method}</td>
                                <td>{formatZar(row.amountMinor)}</td>
                                <td>{row.verification}</td>
                                <td>
                                  {row.verification === "VERIFIED"
                                    ? formatZar(
                                        (
                                          BigInt(row.amountMinor) -
                                          BigInt(row.allocatedMinor)
                                        ).toString(),
                                      )
                                    : "Await independent verification"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!data.payments?.length && <p>No payments recorded.</p>}
                      </div>
                    </section>
                    {can("finance.transactions.record") && (
                      <div className={s.grid}>
                        <details className={s.card}>
                          <summary>Record a reported payment</summary>
                          <form
                            className={s.form}
                            onSubmit={(e) =>
                              void submit(e, (f) => ({
                                command: "PAYMENT",
                                reference: f.get("reference"),
                                amountMinor: money(f),
                                method: f.get("method"),
                              }))
                            }
                          >
                            <fieldset disabled={formsDisabled}>
                              <Field
                                label="Unique payment reference"
                                name="reference"
                              />
                              <Field label="Amount (R)" name="amount" />
                              <label>
                                Method
                                <select name="method">
                                  {["EFT", "CASH", "CARD", "OTHER"].map(
                                    (value) => (
                                      <option key={value}>{value}</option>
                                    ),
                                  )}
                                </select>
                              </label>
                              <button>
                                Record for independent verification
                              </button>
                            </fieldset>
                          </form>
                        </details>
                        <details className={s.card}>
                          <summary>
                            Allocate verified money to an invoice
                          </summary>
                          <form
                            className={s.form}
                            onSubmit={(e) =>
                              void submit(e, (f) => ({
                                command: "ALLOCATE",
                                paymentId: f.get("paymentId"),
                                invoiceId: f.get("invoiceId"),
                                amountMinor: money(f),
                              }))
                            }
                          >
                            <fieldset disabled={formsDisabled}>
                              <label>
                                Verified payment
                                <select name="paymentId" required>
                                  <option value="">Choose payment</option>
                                  {data.payments
                                    ?.filter(
                                      (p) =>
                                        p.verification === "VERIFIED" &&
                                        BigInt(p.amountMinor) >
                                          BigInt(p.allocatedMinor),
                                    )
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.reference} ·{" "}
                                        {formatZar(
                                          (
                                            BigInt(p.amountMinor) -
                                            BigInt(p.allocatedMinor)
                                          ).toString(),
                                        )}{" "}
                                        available
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label>
                                Invoice
                                <select name="invoiceId" required>
                                  <option value="">Choose invoice</option>
                                  {data.invoices
                                    ?.filter(
                                      (i) =>
                                        i.status === "ISSUED" &&
                                        BigInt(i.amountMinor) >
                                          BigInt(i.allocatedMinor),
                                    )
                                    .map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.invoiceNumber} · {i.description}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <Field
                                label="Amount to allocate (R)"
                                name="amount"
                              />
                              <p>
                                Check the learner and payment evidence. Each
                                payment/invoice pairing can be allocated once.
                              </p>
                              <button>Allocate</button>
                            </fieldset>
                          </form>
                        </details>
                      </div>
                    )}
                  </>
                )}
                {tab === "budgets" && (
                  <>
                    <section className={s.card}>
                      <h2>Budgets and approved expenditure</h2>
                      <p>
                        Approved expenditure records are commitments recorded
                        here; approval does not execute a bank payment. Salary
                        expenditure is a category, not a payroll service.
                      </p>
                      {data.budgets?.map((row) => (
                        <article className={s.row} key={row.id}>
                          <strong>
                            {row.year} · {row.category}
                          </strong>
                          <span>
                            {formatZar(row.amountMinor)} budget ·{" "}
                            {formatZar(row.approvedMinor)} approved expenditure
                            · {row.status}
                          </span>
                        </article>
                      ))}
                      {!data.budgets?.length && <p>No budgets recorded.</p>}
                      {data.expenses?.map((row) => (
                        <article className={s.row} key={row.id}>
                          <strong>
                            {row.reference} · {row.description}
                          </strong>
                          <span>
                            {formatZar(row.amountMinor)} · {row.status} ·
                            Evidence: {row.evidenceReference}
                          </span>
                        </article>
                      ))}
                    </section>
                    {can("finance.transactions.record") && (
                      <div className={s.grid}>
                        <details className={s.card}>
                          <summary>Prepare a budget</summary>
                          <form
                            className={s.form}
                            onSubmit={(e) =>
                              void submit(e, (f) => ({
                                command: "BUDGET",
                                academicYear: Number(f.get("year")),
                                category: f.get("category"),
                                amountMinor: money(f),
                              }))
                            }
                          >
                            <fieldset disabled={formsDisabled}>
                              <Field
                                label="Academic year"
                                name="year"
                                type="number"
                              />
                              <label>
                                Category
                                <select name="category">
                                  {expenseCategories.map((value) => (
                                    <option key={value}>{value}</option>
                                  ))}
                                </select>
                              </label>
                              <Field label="Budget amount (R)" name="amount" />
                              <button>Submit budget for review</button>
                            </fieldset>
                          </form>
                        </details>
                        <details className={s.card}>
                          <summary>Submit an expense</summary>
                          <form
                            className={s.form}
                            onSubmit={(e) =>
                              void submit(e, (f) => ({
                                command: "EXPENSE",
                                budgetId: f.get("budgetId"),
                                reference: f.get("reference"),
                                description: f.get("description"),
                                amountMinor: money(f),
                                evidenceReference: f.get("evidence"),
                              }))
                            }
                          >
                            <fieldset disabled={formsDisabled}>
                              <label>
                                Approved budget
                                <select name="budgetId" required>
                                  <option value="">Choose budget</option>
                                  {data.budgets
                                    ?.filter((b) => b.status === "APPROVED")
                                    .map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.year} · {b.category}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <Field
                                label="Unique expense reference"
                                name="reference"
                              />
                              <Field label="Description" name="description" />
                              <Field label="Amount (R)" name="amount" />
                              <Field
                                label="Private supporting-document reference"
                                name="evidence"
                              />
                              <button>Submit expense for review</button>
                            </fieldset>
                          </form>
                        </details>
                      </div>
                    )}
                  </>
                )}
                {tab === "review" && (
                  <>
                    {can("finance.policy.manage") && (
                      <FinanceStaff
                        key={schoolId}
                        schoolId={schoolId}
                        schoolName={school.displayName}
                      />
                    )}
                    <section className={s.card}>
                      <h2>Independent review queue</h2>
                      <p>
                        You cannot verify or approve records you prepared.
                        Confirm the independently held evidence before making a
                        decision.
                      </p>
                      {can("finance.payments.verify") &&
                        data.payments
                          ?.filter(
                            (p) =>
                              p.verification === "REPORTED" &&
                              p.preparedBy !== data.personId,
                          )
                          .map((row) => (
                            <form
                              key={row.id}
                              className={s.review}
                              onSubmit={(e) =>
                                void submit(e, (f) => ({
                                  command: "VERIFY_PAYMENT",
                                  paymentId: row.id,
                                  decision: f.get("decision"),
                                  evidenceReference: f.get("evidence"),
                                  reason: f.get("reason"),
                                }))
                              }
                            >
                              <fieldset disabled={busy}>
                                <legend>
                                  Payment {row.reference} ·{" "}
                                  {formatZar(row.amountMinor)}
                                </legend>
                                <Field
                                  label="Checked private evidence reference"
                                  name="evidence"
                                />
                                <Field label="Review reason" name="reason" />
                                <label>
                                  Decision
                                  <select name="decision">
                                    <option value="REJECTED">Reject</option>
                                    <option value="VERIFIED">
                                      Verify against evidence
                                    </option>
                                  </select>
                                </label>
                                <button>Save payment review</button>
                              </fieldset>
                            </form>
                          ))}
                      {can("finance.expenditure.approve") &&
                        [
                          ...(data.budgets ?? [])
                            .filter((b) => b.status === "DRAFT")
                            .map((b) => ({
                              ...b,
                              command: "REVIEW_BUDGET",
                              label: `Budget ${b.year} · ${b.category}`,
                            })),
                          ...(data.expenses ?? [])
                            .filter((e) => e.status === "SUBMITTED")
                            .map((e) => ({
                              ...e,
                              command: "REVIEW_EXPENSE",
                              label: `Expense ${e.reference} · ${e.description}`,
                            })),
                        ]
                          .filter((r) => r.preparedBy !== data.personId)
                          .map((row) => (
                            <div className={s.review} key={row.id}>
                              <strong>
                                {row.label} · {formatZar(row.amountMinor)}
                              </strong>
                              {"evidenceReference" in row && (
                                <p>Supporting evidence: {row.evidenceReference}</p>
                              )}
                              <form className={s.form} onSubmit={(e) =>
                                void submit(e, (f) => ({
                                  command: row.command,
                                  resourceId: row.id,
                                  decision: f.get("decision"),
                                  reason: f.get("reason"),
                                }))
                              }>
                                <fieldset disabled={busy}>
                                  <label>
                                    Review reason
                                    <input name="reason" required maxLength={500} />
                                  </label>
                                  <label>
                                    Decision
                                    <select name="decision">
                                      <option value="REJECTED">Reject</option>
                                      <option value="APPROVED">Approve</option>
                                    </select>
                                  </label>
                                  <button>Save independent review</button>
                                </fieldset>
                              </form>
                            </div>
                          ))}
                    </section>
                    <section className={s.card}>
                      <h2>Ledger reconciliation</h2>
                      <p>
                        Periods use UTC record timestamps. Submission stores a
                        fingerprint and totals of the period records. Approval
                        requires unchanged records and independent review. This
                        is not a bank reconciliation or a period close.
                      </p>
                      {data.reconciliations?.map((row) => (
                        <article className={s.review} key={row.id}>
                          <h3>
                            {row.periodStart} – {row.periodEnd}
                          </h3>
                          <p>
                            {row.status} · Revision {row.revision}
                            {row.evidenceReference
                              ? ` · Evidence: ${row.evidenceReference}`
                              : ""}
                          </p>
                          {row.snapshot && (
                            <p>
                              {row.snapshot.recordCount} records · invoiced{" "}
                              {formatZar(row.snapshot.invoicedMinor)} · verified
                              payments {formatZar(row.snapshot.verifiedMinor)} ·
                              allocated {formatZar(row.snapshot.allocatedMinor)}{" "}
                              · approved expenses{" "}
                              {formatZar(row.snapshot.approvedExpensesMinor)}
                            </p>
                          )}
                          {row.reviewReason && (
                            <p>Review: {row.reviewReason}</p>
                          )}
                          {row.status === "DRAFT" &&
                            row.preparedBy === data.personId &&
                            can("finance.reconciliation.prepare") && (
                              <form
                                className={s.form}
                                onSubmit={(e) =>
                                  void submit(e, (f) => ({
                                    command: "SUBMIT_RECONCILIATION",
                                    reconciliationId: row.id,
                                    evidenceReference: f.get("evidence"),
                                  }))
                                }
                              >
                                <fieldset disabled={busy}>
                                  <Field
                                    label="Supporting reconciliation document reference"
                                    name="evidence"
                                  />
                                  <button>
                                    Submit snapshot for independent review
                                  </button>
                                </fieldset>
                              </form>
                            )}
                          {row.status === "SUBMITTED" &&
                            row.preparedBy !== data.personId &&
                            can("finance.reconciliation.approve") && (
                              <form
                                className={s.form}
                                onSubmit={(e) =>
                                  void submit(e, (f) => ({
                                    command: "REVIEW_RECONCILIATION",
                                    reconciliationId: row.id,
                                    decision: f.get("decision"),
                                    reason: f.get("reason"),
                                  }))
                                }
                              >
                                <fieldset disabled={busy}>
                                  <Field label="Review reason" name="reason" />
                                  <label>
                                    Decision
                                    <select name="decision">
                                      <option value="REJECTED">Reject</option>
                                      <option value="APPROVED">
                                        Approve checked snapshot
                                      </option>
                                    </select>
                                  </label>
                                  <button>Save reconciliation review</button>
                                </fieldset>
                              </form>
                            )}
                        </article>
                      ))}
                      {!data.reconciliations?.length && (
                        <p>No reconciliation periods recorded.</p>
                      )}
                    </section>
                    {can("finance.reconciliation.prepare") && (
                      <details className={s.card}>
                        <summary>Prepare a reconciliation period</summary>
                        <form
                          className={s.form}
                          onSubmit={(e) =>
                            void submit(e, (f) => ({
                              command: "RECONCILIATION",
                              periodStart: f.get("start"),
                              periodEnd: f.get("end"),
                            }))
                          }
                        >
                          <fieldset disabled={formsDisabled}>
                            <Field
                              label="Period start"
                              name="start"
                              type="date"
                            />
                            <Field label="Period end" name="end" type="date" />
                            <p>
                              For a rejected period, its original preparer can
                              create a new revision using the same dates. Its
                              earlier decisions remain in the audit trail.
                            </p>
                            <button>Create draft</button>
                          </fieldset>
                        </form>
                      </details>
                    )}
                  </>
                )}
                {tab === "audit" && data.audit && (
                  <section className={s.card}>
                    <h2>Recent financial activity</h2>
                    <p>Latest 100 audited actions for this school account.</p>
                    <ol>
                      {data.audit.map((row, i) => (
                        <li key={`${row.occurredAt}-${i}`}>
                          {row.action} · {row.resourceType} · {row.occurredAt}
                          <div>Record: {row.resourceId} · Reviewer/actor ID: {row.actorPersonId}</div>
                          {row.decision && <div>Decision: {row.decision}</div>}
                          {row.reason && <div>Reason: {row.reason}</div>}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
