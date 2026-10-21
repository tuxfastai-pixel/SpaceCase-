import { cookies } from "next/headers";
import { readServerEnvironment } from "../config/env";
import { PeosSessionResolver } from "../session/peosSessionResolver";
import { PEOS_SESSION_COOKIE } from "../session/peosAuthorization";

export async function currentSession() {
  const env = readServerEnvironment();
  const token = (await cookies()).get(PEOS_SESSION_COOKIE)?.value;
  if (!env.PEOS_BASE_URL || !token) return null;
  return new PeosSessionResolver(env.PEOS_BASE_URL).resolve(new Request("https://spacecase.invalid", {
    headers: { authorization: `Bearer ${token}` },
  }));
}
