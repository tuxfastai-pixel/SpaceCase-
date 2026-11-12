import type { Pool } from "pg";
import { auditHistoryQuery, type AuditHistoryInput, type AuditHistoryRow } from "./auditHistoryContracts";
import { financeAuthority, financeTransaction, lockFinanceAccount, financeAudit, type FinanceAuthority } from "./workspaceService";

export async function readFinanceAuditHistory(pool: Pool, raw: AuditHistoryInput, actorPersonId: string, authorize: FinanceAuthority) {
  const input = auditHistoryQuery.parse(raw);
  const scope = { schoolId: input.schoolId, accountId: input.accountId, actorPersonId };
  await financeAuthority(scope, "finance.audit.read", authorize);
  return financeTransaction(pool, async db => {
    await lockFinanceAccount(db, scope);
    const values: unknown[] = [input.accountId];
    const conditions = ["account_id=$1"];
    const add = (sql: string, value: unknown) => { values.push(value); conditions.push(sql.replace("?", "$" + values.length)); };
    if (input.start) add("occurred_at >= ?::date AT TIME ZONE 'UTC'", input.start);
    if (input.end) add("occurred_at < (?::date+1) AT TIME ZONE 'UTC'", input.end);
    if (input.action) add("action=?", input.action);
    if (input.resourceId) add("resource_id=?", input.resourceId);
    if (input.cursor) {
      values.push(input.cursor.at, input.cursor.id);
      conditions.push(`(occurred_at,id)<($${values.length-1}::timestamptz,$${values.length}::uuid)`);
    }
    const result = await db.query<AuditHistoryRow>(`SELECT id,
      to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "occurredAt",
      actor_peos_person_id AS "actorPersonId",action,resource_type AS "resourceType",resource_id AS "resourceId",
      metadata->>'decision' AS decision,metadata->>'reason' AS reason
      FROM school_finance.audit_events WHERE ${conditions.join(" AND ")}
      ORDER BY occurred_at DESC,id DESC LIMIT 101`, values);
    const rows = result.rows.slice(0,100), last = rows.at(-1);
    await financeAudit(db, scope, input.format === "csv" ? "FINANCE_AUDIT_HISTORY_EXPORTED" : "FINANCE_AUDIT_HISTORY_READ", "ACCOUNT", input.accountId, { returned: rows.length });
    return { rows, nextCursor: result.rows.length > 100 && last ? JSON.stringify({ at: last.occurredAt, id: last.id }) : null };
  });
}

