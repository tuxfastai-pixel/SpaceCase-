import { z } from "zod";
import { financeDate } from "./workspaceContracts";
const cursor = z.object({ at: z.string().datetime({ precision: 6 }), id: z.string().uuid() }).strict();
export const auditHistoryQuery = z.object({
  format: z.literal("csv").optional(),
  schoolId: z.string().uuid().toLowerCase(),
  accountId: z.string().uuid(),
  start: financeDate.optional(),
  end: financeDate.optional(),
  action: z.string().regex(/^FINANCE_[A-Z_]{1,70}$/).optional(),
  resourceId: z.string().uuid().optional(),
  cursor: z.string().max(200).transform(value => cursor.parse(JSON.parse(value))).optional(),
}).strict().refine(value => !value.start || !value.end || value.start <= value.end, "Start must precede end");
export type AuditHistoryInput = z.input<typeof auditHistoryQuery>;
export type AuditHistoryRow = {
  id: string; occurredAt: string; actorPersonId: string; action: string;
  resourceType: string; resourceId: string; decision: string | null; reason: string | null;
};
export function financeAuditCsv(rows: AuditHistoryRow[]) {
  // Quoting does not stop spreadsheet formula execution; neutralize formula prefixes too.
  const cell = (value: string | null) => {
    let text = value ?? "";
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [ ["Event ID","UTC timestamp","Actor ID","Action","Resource type","Resource ID","Decision","Reason"],
    ...rows.map(row => [row.id,row.occurredAt,row.actorPersonId,row.action,row.resourceType,row.resourceId,row.decision,row.reason])
  ].map(row => row.map(cell).join(",")).join("\r\n");
}
