import { z } from "zod";
import { requireFinanceLearner } from "@/platform/finance/peosAuthorization";
import { financeFailure } from "@/platform/finance/workspaceHttp";
export async function GET(request: Request) {
  const headers = { "cache-control": "no-store" };
  if (
    process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED !== "true" ||
    process.env.SPACECASE_WORKSPACE_MODE === "authority_only"
  )
    return Response.json(
      { error: "FINANCE_NOT_ENABLED" },
      { status: 503, headers },
    );
  try {
    const params = new URL(request.url).searchParams;
    const schoolId = z
        .string()
        .uuid()
        .toLowerCase()
        .parse(params.get("schoolId")),
      reference = z
        .string()
        .trim()
        .min(1)
        .max(40)
        .parse(params.get("reference"));
    return Response.json(
      await requireFinanceLearner(request, schoolId, reference),
      { headers },
    );
  } catch (error) {
    return financeFailure(error);
  }
}
