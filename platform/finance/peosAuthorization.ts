import { z } from "zod";
import { readServerEnvironment } from "../config/env";
import { resolvePeosAuthorization } from "../session/peosAuthorization";

export const financeActions = [
  "finance.summary.read", "finance.transactions.read", "finance.transactions.record",
  "finance.reconciliation.prepare", "finance.reconciliation.approve",
  "finance.policy.manage", "finance.expenditure.approve", "finance.audit.read", "finance.payments.verify",
] as const;
export type FinanceAction = (typeof financeActions)[number];
const decisionSchema = z.object({
  allowed: z.literal(true),
  schoolId: z.string().uuid(),
  action: z.enum(financeActions),
  personId: z.string().uuid(),
}).strict();

export class FinanceAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403 | 503, message: string) { super(message); }
}

/**
 * Fail-closed PEOS authority adapter. The contract endpoint must be implemented and
 * authenticated by PEOS before any finance route uses this adapter.
 * A 200 without an exact affirmative scoped decision never authorizes access.
 */
export async function requireSchoolFinancePermission(
  request: Request,
  schoolId: string,
  action: FinanceAction,
  fetchImpl: typeof fetch = fetch,
): Promise<{ schoolId: string; personId: string; action: FinanceAction }> {
  if (!z.string().uuid().safeParse(schoolId).success || !financeActions.includes(action))
    throw new FinanceAuthorizationError(403, "FINANCE_SCOPE_INVALID");
  const authorization = resolvePeosAuthorization(request);
  if (!authorization) throw new FinanceAuthorizationError(401, "UNAUTHENTICATED");
  const env = readServerEnvironment();
  if (!env.PEOS_BASE_URL) throw new FinanceAuthorizationError(503, "PEOS_UNAVAILABLE");
  let response: Response;
  try {
    const url = new URL(`/v1/finance/schools/${encodeURIComponent(schoolId)}/authorize`, env.PEOS_BASE_URL);
    response = await fetchImpl(url, {
      method: "POST",
      headers: { authorization, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ action }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new FinanceAuthorizationError(503, "PEOS_UNAVAILABLE"); }
  if (response.status === 401) throw new FinanceAuthorizationError(401, "UNAUTHENTICATED");
  if (response.status === 403) throw new FinanceAuthorizationError(403, "FINANCE_FORBIDDEN");
  if (!response.ok) throw new FinanceAuthorizationError(503, "PEOS_UNAVAILABLE");
  let parsed: unknown;
  try { parsed = await response.json(); }
  catch { throw new FinanceAuthorizationError(503, "PEOS_INVALID_AUTHORITY_RESPONSE"); }
  const decision = decisionSchema.safeParse(parsed);
  if (!decision.success || decision.data.schoolId !== schoolId || decision.data.action !== action)
    throw new FinanceAuthorizationError(403, "FINANCE_FORBIDDEN");
  return decision.data;
}

export const financeSchoolSchema=z.object({id:z.string().uuid(),displayName:z.string().max(200),actions:z.array(z.enum(financeActions)).max(20)}).strict();
export async function financeSchools(authorization:string,fetchImpl:typeof fetch=fetch){
 const env=readServerEnvironment();if(!env.PEOS_BASE_URL)throw new FinanceAuthorizationError(503,"PEOS_UNAVAILABLE");
 const response=await fetchImpl(new URL("/v1/finance/schools",env.PEOS_BASE_URL),{headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new FinanceAuthorizationError(response.status===401?401:503,"FINANCE_AUTHORITY_UNAVAILABLE");
 return z.object({schools:z.array(financeSchoolSchema).max(100),truncated:z.boolean()}).parse(await response.json());
}
export async function requireFinanceLearner(request:Request,schoolId:string,reference:string){
 const env=readServerEnvironment(),authorization=resolvePeosAuthorization(request);
 if(!authorization)throw new FinanceAuthorizationError(401,"UNAUTHENTICATED");
 if(!env.PEOS_BASE_URL)throw new FinanceAuthorizationError(503,"PEOS_UNAVAILABLE");
 const url=new URL(`/v1/finance/schools/${encodeURIComponent(schoolId)}/learner`,env.PEOS_BASE_URL);url.searchParams.set("reference",reference);
 const response=await fetch(url,{headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new FinanceAuthorizationError(response.status===403?403:503,"FINANCE_LEARNER_UNAVAILABLE");
 return z.object({personId:z.string().uuid(),admissionNumber:z.string(),givenName:z.string(),familyName:z.string()}).strict().parse(await response.json());
}
