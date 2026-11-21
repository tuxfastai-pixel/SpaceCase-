import {
  financeWorkspaceGet,
  financeWorkspacePost,
} from "@/platform/finance/workspaceHttp";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return financeWorkspaceGet(request);
}
export async function POST(request: Request) {
  return financeWorkspacePost(request);
}
