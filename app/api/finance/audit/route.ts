import { financeAuditHistoryGet } from "@/platform/finance/workspaceHttp";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return financeAuditHistoryGet(request);
}
