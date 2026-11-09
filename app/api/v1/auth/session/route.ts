import { z } from "zod";

import { readServerEnvironment } from "../../../../../platform/config/env";
import { PEOS_SESSION_COOKIE, resolvePeosAuthorization } from "../../../../../platform/session/peosAuthorization";

const exchangeSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  session: z.object({
    sessionId: z.string().min(1),
    personId: z.string().min(1),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),
});

function cookieValue(token: string, expiresAt: string, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return [
    `${PEOS_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearCookie(secure: boolean): string {
  return [
    `${PEOS_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(request: Request): Promise<Response> {
  const environment = readServerEnvironment();
  if (!environment.PEOS_BASE_URL) {
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }

  const externalAuthorization = request.headers.get("authorization");
  if (!externalAuthorization?.startsWith("Bearer ")) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  // Vercel Trusted Sources uses a short-lived deployment token, not the user's token.
  const trustedOidcToken = process.env.VERCEL_OIDC_TOKEN;
  if (process.env.VERCEL_ENV === "preview" && !trustedOidcToken) {
    console.error("SPACECASE_PEOS_EXCHANGE", { outcome: "missing_vercel_oidc_token" });
  }

  // Log only bounded diagnostic categories; never log tokens, cookies or response bodies.
  let response: Response;
  try {
    response = await fetch(new URL("/v1/sessions/exchange", environment.PEOS_BASE_URL), {
      method: "POST",
      headers: {
        authorization: externalAuthorization,
        accept: "application/json",
        ...(process.env.VERCEL_ENV === "preview" && trustedOidcToken
          ? { "x-vercel-trusted-oidc-idp-token": trustedOidcToken }
          : {}),
      },
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error("SPACECASE_PEOS_EXCHANGE", {
      outcome: "network_failure",
      category: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "fetch_failed",
    });
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }

  if (!response.ok) {
    // Log only a fixed allowlist of upstream error codes, never response bodies or identity data.
    let upstreamCode = "unknown";
    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        const payload: unknown = await response.clone().json();
        if (payload && typeof payload === "object" && "error" in payload) {
          const code = (payload as { error?: unknown }).error;
          if (typeof code === "string" && [
            "UNAUTHENTICATED", "IDENTITY_NOT_PROVISIONED", "PEOS_UNAVAILABLE",
            "DEPLOYMENT_NOT_FOUND", "NOT_AUTHORIZED", "UNAUTHORIZED",
          ].includes(code)) upstreamCode = code;
        }
      } catch { /* Do not log upstream response content. */ }
    }
    console.error("SPACECASE_PEOS_EXCHANGE", {
      outcome: "upstream_rejected",
      status: response.status,
      upstreamCode,
      responseType: response.headers.get("content-type")?.includes("application/json") ? "json" : response.headers.get("content-type")?.startsWith("text/html") ? "html" : "other",
      vercelMitigation: response.headers.has("x-vercel-mitigated"),
      upstreamErrorCode: response.headers.get("x-vercel-error") ? "vercel_error" : "none",
    });
    if (response.status === 401 || response.status === 403) {
      return Response.json({ error: response.status === 403 ? "IDENTITY_NOT_PROVISIONED" : "UNAUTHENTICATED" }, { status: response.status });
    }
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }

  // A protected upstream can return an HTML sign-in page with HTTP 200.
  if (!response.headers.get("content-type")?.includes("application/json")) {
    console.error("SPACECASE_PEOS_EXCHANGE", {
      outcome: "unexpected_content_type",
      status: response.status,
      responseType: response.headers.get("content-type")?.startsWith("text/html") ? "html" : "other",
    });
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }
  let exchanged: z.infer<typeof exchangeSchema>;
  try {
    exchanged = exchangeSchema.parse(await response.json());
  } catch {
    console.error("SPACECASE_PEOS_EXCHANGE", { outcome: "invalid_session_payload", status: response.status });
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append(
    "set-cookie",
    cookieValue(exchanged.accessToken, exchanged.session.expiresAt, environment.NODE_ENV === "production"),
  );

  return Response.json({ session: exchanged.session }, { status: 201, headers });
}

export async function DELETE(request: Request): Promise<Response> {
  const environment = readServerEnvironment();
  const authorization = resolvePeosAuthorization(request);

  if (environment.PEOS_BASE_URL && authorization) {
    try {
      await fetch(new URL("/v1/sessions/revoke", environment.PEOS_BASE_URL), {
        method: "POST",
        headers: { authorization, accept: "application/json" },
        cache: "no-store", signal:AbortSignal.timeout(5000),
      });
    } catch {
      // Cookie clearing remains local and deterministic even if PEOS is temporarily unavailable.
    }
  }

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearCookie(environment.NODE_ENV === "production"));
  return Response.json({ signedOut: true }, { headers });
}
