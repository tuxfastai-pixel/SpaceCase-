import { NextResponse } from "next/server";
import { authConfiguration, createAuthClient } from "../../../platform/auth/supabase";
import { POST as exchangeSession } from "../../api/v1/auth/session/route";
import { completeSignIn } from "../../../platform/auth/completeSignIn";
import { cookies } from "next/headers";
import {familyInvitationsEnabled,FAMILY_INVITATION_COOKIE} from '../../../platform/family/invitationConfig';
import { INVITATION_COOKIE } from "../../../platform/admin/peosProxy";

export async function GET(request: Request) {
  const { origin } = authConfiguration();
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  if (!code || params.has("error")) return NextResponse.redirect(`${origin}/login?error=signin`, 303);
  try {
    const client = await createAuthClient();
    // PKCE checks the code against the verifier stored in this browser's HttpOnly cookie.
    const result = await completeSignIn(code,
      (value) => client.auth.exchangeCodeForSession(value),
      (token) => exchangeSession(new Request(`${origin}/api/v1/auth/session`, {
        method: "POST", headers: { authorization: `Bearer ${token}` },
      })));
    if ("cookie" in result) {
      const jar=await cookies();
      const destination = familyInvitationsEnabled()&&jar.has(FAMILY_INVITATION_COOKIE)?"/family/invitation":jar.has(INVITATION_COOKIE)?"/join":"/dashboard";
      const response = NextResponse.redirect(`${origin}${destination}`, 303);
      response.headers.append("set-cookie", result.cookie);
      response.headers.set("cache-control", "no-store");
      response.headers.set("referrer-policy", "no-referrer");
      return response;
    }
    await client.auth.signOut({ scope: "local" });
    return NextResponse.redirect(`${origin}/login?error=${result.error}`, 303);
  } catch { /* Keep authorization codes, access tokens and internal errors private. */ }
  return NextResponse.redirect(`${origin}/login?error=signin`, 303);
}
