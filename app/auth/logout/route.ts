import { NextResponse } from "next/server";
import {onboardingCookie} from "../../../platform/auth/onboardingPath";
import { authConfiguration, createAuthClient } from "../../../platform/auth/supabase";
import { DELETE as revokeSession } from "../../api/v1/auth/session/route";

export async function POST(request: Request) {
  const { origin } = authConfiguration();
  if (request.headers.get("origin") !== origin) return new Response("Forbidden", { status: 403 });
  const revoked = await revokeSession(request);
  try { await (await createAuthClient()).auth.signOut({ scope: "local" }); } catch { /* PEOS cookie is cleared regardless. */ }
  const response = NextResponse.redirect(`${origin}/login`, 303);
  const cookie = revoked.headers.get("set-cookie");
  if (cookie) response.headers.append("set-cookie", cookie);
  response.headers.append("set-cookie",onboardingCookie("existing",process.env.NODE_ENV==="production",true));
  response.headers.set("cache-control", "no-store");
  return response;
}
