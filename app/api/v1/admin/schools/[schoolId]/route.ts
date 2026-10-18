import { peosProxy } from "@/platform/admin/peosProxy";
type Context = { params: Promise<{ schoolId: string }> };
export async function PATCH(request: Request, context: Context) {
  const { schoolId } = await context.params;
  return peosProxy(request, `/v1/admin/schools/${encodeURIComponent(schoolId)}`, await request.json().catch(() => null));
}
