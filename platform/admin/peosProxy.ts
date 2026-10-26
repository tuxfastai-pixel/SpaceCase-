import {z} from "zod";
import { readServerEnvironment } from "../config/env";
import { resolvePeosAuthorization } from "../session/peosAuthorization";

export const INVITATION_COOKIE = "spacecase_invitation";
export function sameOrigin(request: Request) {
  const origin = readServerEnvironment().SPACECASE_PUBLIC_URL;
  return Boolean(origin && request.headers.get("origin") === new URL(origin).origin);
}

export async function peosProxy(request: Request, path: string, body?: unknown, extraHeaders: Record<string, string> = {}, timeoutMs = 15_000) {
  const env = readServerEnvironment();
  if (request.method !== "GET" && !sameOrigin(request)) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const authorization = resolvePeosAuthorization(request);
  if (!authorization) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!env.PEOS_BASE_URL) return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  try {
    const response = await fetch(new URL(path, env.PEOS_BASE_URL), {
      method: request.method, headers: { authorization, accept: "application/json", "content-type": "application/json", ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    });
    return Response.json(await response.json(), { status: response.status, headers: { "cache-control": "no-store" } });
  } catch { return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 }); }
}

export async function adminSchools(authorization: string, fetchImpl:typeof fetch=fetch) {
  const env = readServerEnvironment();
  if (!env.PEOS_BASE_URL) throw new Error("PEOS_UNAVAILABLE");
  const response = await fetchImpl(new URL("/v1/admin/schools", env.PEOS_BASE_URL), {
    headers: { authorization }, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("WORKSPACE_AUTHORITY_UNAVAILABLE");
  const data = z.object({schools:z.array(z.object({id:z.string().uuid(),displayName:z.string(),principal:z.boolean().default(false)}))}).parse(await response.json());
  return data.schools;
}
