import { cookies } from "next/headers";
import { INVITATION_COOKIE, peosProxy, sameOrigin } from "@/platform/admin/peosProxy";
import { createAuthClient } from "@/platform/auth/supabase";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const jar = await cookies();
  const token = jar.get(INVITATION_COOKIE)?.value;
  if (!token) return Response.json({ error: "INVITATION_UNAVAILABLE" }, { status: 410 });
  const { data, error } = await (await createAuthClient()).auth.getSession();
  if (error || !data.session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const response = await peosProxy(request, "/v1/invitations/accept", { token }, { "x-psg-identity-token": data.session.access_token });
  if (response.ok) jar.delete(INVITATION_COOKIE);
  return response;
}
