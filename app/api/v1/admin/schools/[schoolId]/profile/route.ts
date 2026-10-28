import { peosProxy } from "@/platform/admin/peosProxy";
type Context = { params: Promise<{ schoolId: string }> };
export async function GET(request: Request, context: Context) {
  const { schoolId } = await context.params;
  return peosProxy(request, `/v1/admin/schools/${encodeURIComponent(schoolId)}/profile`);
}
export async function PUT(request: Request, context: Context) {
  const { schoolId } = await context.params;
  return peosProxy(request, `/v1/admin/schools/${encodeURIComponent(schoolId)}/profile`, await request.json().catch(() => null));
}
