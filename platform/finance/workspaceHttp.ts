import {csvDownloadName} from "../downloads/filename";
import { z } from "zod";
import type { Pool } from "pg";
import { getDatabasePool } from "../db/pool";
import { boundedText } from "../http/boundedText";
import { financeCommand } from "../../domains/school-finance/workspaceContracts";
import {
  initializeFinance,
  readFinanceWorkspace,
  recordFinance,
  type FinanceAuthority,
} from "../../domains/school-finance/workspaceService";
import { allocateVerifiedSchoolPayment } from "../../domains/school-finance/allocationService";
import {
  createSchoolReconciliation,
  submitSchoolReconciliation,
  reviewSchoolReconciliation,
} from "../../domains/school-finance/reconciliationService";
import { SchoolFinanceError } from "../../domains/school-finance/money";
import {
  requireSchoolFinancePermission,
  requireFinanceLearner,
  FinanceAuthorizationError,
} from "./peosAuthorization";
import { readFinanceAuditHistory } from "../../domains/school-finance/auditHistory";
import { auditHistoryQuery, financeAuditCsv, type AuditHistoryInput } from "../../domains/school-finance/auditHistoryContracts";
const headers = { "cache-control": "no-store" };
export function financeFailure(error: unknown) {
  if (error instanceof FinanceAuthorizationError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers },
    );
  if (error instanceof RangeError)
    return Response.json(
      { error: "REQUEST_TOO_LARGE" },
      { status: 413, headers },
    );
  if (error instanceof SyntaxError || error instanceof z.ZodError)
    return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers });
  if (error instanceof SchoolFinanceError)
    return Response.json(
      { error: error.message },
      { status: error.message === "FINANCE_FORBIDDEN" ? 403 : 409, headers },
    );
  if ((error as { code?: string })?.code === "23505")
    return Response.json(
      { error: "FINANCE_DUPLICATE_REFERENCE" },
      { status: 409, headers },
    );
  // Log only a bounded classification: never raw errors, connection strings or records.
  const code = (error as { code?: unknown })?.code;
  const diagnostic = typeof code === "string" && ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "53300", "57P03"].includes(code)
    ? code : error instanceof Error && /connection timeout|timeout exceeded when trying to connect/i.test(error.message)
      ? "DB_CONNECTION_TIMEOUT" : "UNEXPECTED_FAILURE";
  console.error("[finance-service-unavailable]", { diagnostic });
  return Response.json(
    { error: "FINANCE_SERVICE_UNAVAILABLE" },
    { status: 503, headers },
  );
}
function enabled() {
  return (
    process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED === "true" &&
    process.env.SPACECASE_WORKSPACE_MODE !== "authority_only"
  );
}
type Dependencies = {
  pool: () => Pool;
  permission: typeof requireSchoolFinancePermission;
  learner: typeof requireFinanceLearner;
};
const defaults: Dependencies = {
  pool: getDatabasePool,
  permission: requireSchoolFinancePermission,
  learner: requireFinanceLearner,
};
export async function financeWorkspaceGet(
  request: Request,
  deps: Dependencies = defaults,
) {
  if (!enabled())
    return Response.json(
      { error: "FINANCE_NOT_ENABLED" },
      { status: 503, headers },
    );
  try {
    const schoolId = z
      .string()
      .uuid()
      .toLowerCase()
      .parse(new URL(request.url).searchParams.get("schoolId"));
    const decision = await deps.permission(
      request,
      schoolId,
      "finance.transactions.read",
    );
    return Response.json(
      {
        ...(await readFinanceWorkspace(
          deps.pool(),
          schoolId,
          decision.personId,
          (school, action) => deps.permission(request, school, action),
        )),
        personId: decision.personId,
      },
      { headers },
    );
  } catch (error) {
    return financeFailure(error);
  }
}
export async function financeWorkspacePost(
  request: Request,
  deps: Dependencies = defaults,
) {
  if (!enabled())
    return Response.json(
      { error: "FINANCE_NOT_ENABLED" },
      { status: 503, headers },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
  try {
    const input = financeCommand.parse(
      JSON.parse(await boundedText(request, 64000)),
    );
    const action =
      input.command === "INITIALIZE"
        ? "finance.policy.manage"
        : input.command === "VERIFY_PAYMENT"
          ? "finance.payments.verify"
          : input.command === "REVIEW_BUDGET" ||
              input.command === "REVIEW_EXPENSE"
            ? "finance.expenditure.approve"
            : input.command === "REVIEW_RECONCILIATION"
              ? "finance.reconciliation.approve"
              : input.command === "RECONCILIATION" ||
                  input.command === "SUBMIT_RECONCILIATION"
                ? "finance.reconciliation.prepare"
                : "finance.transactions.record";
    const decision = await deps.permission(request, input.schoolId, action),
      actorPersonId = decision.personId;
    const authorize: FinanceAuthority = (school, permission) =>
      deps.permission(request, school, permission);
    const pool = deps.pool();
    let result: unknown;
    if (input.command === "INITIALIZE")
      result = await initializeFinance(
        pool,
        input.schoolId,
        actorPersonId,
        authorize,
      );
    else if (input.command === "ALLOCATE")
      result = await allocateVerifiedSchoolPayment(
        pool,
        { ...input, actorPersonId },
        authorize,
      );
    else if (input.command === "RECONCILIATION")
      result = await createSchoolReconciliation(
        pool,
        { ...input, actorPersonId },
        authorize,
      );
    else if (input.command === "SUBMIT_RECONCILIATION")
      result = await submitSchoolReconciliation(
        pool,
        { ...input, actorPersonId },
        authorize,
      );
    else if (input.command === "REVIEW_RECONCILIATION")
      result = await reviewSchoolReconciliation(
        pool,
        { ...input, actorPersonId },
        authorize,
      );
    else {
      const learner =
        input.command === "INVOICE"
          ? await deps.learner(request, input.schoolId, input.learnerReference)
          : undefined;
      if (
        input.command === "INVOICE" &&
        learner?.personId !== input.confirmedLearnerId
      )
        throw new SchoolFinanceError("FINANCE_LEARNER_CHANGED");
      result = await recordFinance(
        pool,
        input,
        actorPersonId,
        authorize,
        learner?.personId,
      );
    }
    return Response.json(result, { status: 201, headers });
  } catch (error) {
    return financeFailure(error);
  }
}


export async function financeAuditHistoryGet(request: Request, deps: Dependencies = defaults) {
  if (!enabled()) return Response.json({error: "FINANCE_NOT_ENABLED"}, {status: 503, headers});
  try {
    const params = new URL(request.url).searchParams;
    // Reject repeated parameters rather than silently selecting an ambiguous scope.
    for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new SyntaxError("Duplicate parameter");
    const raw = Object.fromEntries(params);
    auditHistoryQuery.parse(raw);
    const decision = await deps.permission(request, raw.schoolId.toLowerCase(), "finance.audit.read");
    const page = await readFinanceAuditHistory(deps.pool(), raw as AuditHistoryInput,
      decision.personId, (school, action) => deps.permission(request, school, action));
    if (raw.format === "csv") return new Response(financeAuditCsv(page.rows), {headers: {
      ...headers, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${csvDownloadName({topic:raw.action?`${raw.action}-audit-history`:"financial-audit-history",school:raw.schoolId,start:raw.start,end:raw.end})}"`,
      "x-content-type-options": "nosniff",
    }});
    return Response.json(page, {headers});
  } catch (error) { return financeFailure(error); }
}
