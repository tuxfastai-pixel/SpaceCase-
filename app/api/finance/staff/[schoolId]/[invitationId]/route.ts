import { peosProxy } from "@/platform/admin/peosProxy";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ schoolId: string; invitationId: string }> },
) {
  const p = await context.params;
  return peosProxy(
    request,
    `/v1/finance/schools/${encodeURIComponent(p.schoolId)}/staff/${encodeURIComponent(p.invitationId)}`,
  );
}
