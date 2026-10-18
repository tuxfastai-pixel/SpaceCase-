import { cookies } from "next/headers";
import { INVITATION_COOKIE, peosProxy } from "@/platform/admin/peosProxy";
export async function POST(request: Request) {
  const token = (await cookies()).get(INVITATION_COOKIE)?.value;
  if (!token) return Response.json({ error: "INVITATION_UNAVAILABLE" }, { status: 410 });
  return peosProxy(request, "/v1/invitations/preview", { token });
}
