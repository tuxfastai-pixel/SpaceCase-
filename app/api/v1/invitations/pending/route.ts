import { cookies } from "next/headers";
import { INVITATION_COOKIE, sameOrigin } from "@/platform/admin/peosProxy";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const input = await request.json().catch(() => null) as { token?: unknown } | null;
  if (typeof input?.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) return Response.json({ error: "INVALID_INVITATION" }, { status: 400 });
  (await cookies()).set(INVITATION_COOKIE, input.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 1800 });
  return Response.json({ pending: true }, { headers: { "cache-control": "no-store" } });
}
