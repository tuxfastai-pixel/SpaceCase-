import { NextResponse } from "next/server";
import { authConfiguration, createAuthClient } from "../../../platform/auth/supabase";

export async function POST(request: Request) {
  const config = authConfiguration();
  if (request.headers.get("origin") !== config.origin) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${config.origin}/auth/callback`, skipBrowserRedirect: true },
    });
    if (!error && data.url) {
      const destination = new URL(data.url);
      if (destination.origin === new URL(config.url).origin) {
        return NextResponse.redirect(destination, 303);
      }
    }
  } catch { /* Never include tokens or provider errors in redirects. */ }
  return NextResponse.redirect(`${config.origin}/login?error=signin`, 303);
}
