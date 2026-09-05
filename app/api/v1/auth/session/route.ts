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

  const response = await fetch(new URL("/v1/sessions/exchange", environment.PEOS_BASE_URL), {
    method: "POST",
    headers: {
      authorization: externalAuthorization,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return Response.json({ error: response.status === 403 ? "IDENTITY_NOT_PROVISIONED" : "UNAUTHENTICATED" }, { status: response.status });
  }
  if (!response.ok) {
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }

  const exchanged = exchangeSchema.parse(await response.json());
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
        cache: "no-store",
      });
    } catch {
      // Cookie clearing remains local and deterministic even if PEOS is temporarily unavailable.
    }
  }

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearCookie(environment.NODE_ENV === "production"));
  return Response.json({ signedOut: true }, { headers });
}
