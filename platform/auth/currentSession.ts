import { cookies, headers } from "next/headers";
import { readServerEnvironment } from "../config/env";
import { PeosSessionResolver } from "../session/peosSessionResolver";
import { PEOS_SESSION_COOKIE } from "../session/peosAuthorization";

export async function currentSession() {
  const env = readServerEnvironment();
  const token = (await cookies()).get(PEOS_SESSION_COOKIE)?.value;
  if (!env.PEOS_BASE_URL || !token) return null;
  const incoming = await headers();
  const deploymentToken = process.env.VERCEL_ENV === "preview"
    ? incoming.get("x-vercel-oidc-token")
    : null;
  return new PeosSessionResolver(env.PEOS_BASE_URL).resolve(new Request("https://spacecase.invalid", {
    headers: {
      authorization: `Bearer ${token}`,
      ...(deploymentToken ? { "x-vercel-oidc-token": deploymentToken } : {}),
    },
  }));
}
