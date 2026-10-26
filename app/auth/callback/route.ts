import { NextResponse } from "next/server";
import { authConfiguration, createAuthClient } from "../../../platform/auth/supabase";
import { POST as exchangeSession } from "../../api/v1/auth/session/route";
import { completeSignIn } from "../../../platform/auth/completeSignIn";
import { cookies } from "next/headers";
import {familyInvitationsEnabled,FAMILY_INVITATION_COOKIE} from '../../../platform/family/invitationConfig';
import {ONBOARDING_PATH_COOKIE,onboardingCookie,signInDestination} from "../../../platform/auth/onboardingPath";
import { INVITATION_COOKIE } from "../../../platform/admin/peosProxy";

export async function GET(request: Request) {
  const { origin } = authConfiguration();
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  function finish(response:NextResponse){response.headers.append("set-cookie",onboardingCookie("existing",process.env.NODE_ENV==="production",true));response.headers.set("cache-control","no-store");return response;}
  if (!code || params.has("error")) return finish(NextResponse.redirect(`${origin}/login?error=signin`, 303));
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
      const destination=signInDestination({familyInvitation:familyInvitationsEnabled()&&jar.has(FAMILY_INVITATION_COOKIE),staffInvitation:jar.has(INVITATION_COOKIE),path:jar.get(ONBOARDING_PATH_COOKIE)?.value});
      const response = NextResponse.redirect(`${origin}${destination}`, 303);
      response.headers.append("set-cookie", result.cookie);
      response.headers.set("cache-control", "no-store");
      response.headers.set("referrer-policy", "no-referrer");
      return finish(response);
    }
    await client.auth.signOut({ scope: "local" });
    return finish(NextResponse.redirect(`${origin}/login?error=${result.error}`, 303));
  } catch { /* Keep authorization codes, access tokens and internal errors private. */ }
  return finish(NextResponse.redirect(`${origin}/login?error=signin`, 303));
}
