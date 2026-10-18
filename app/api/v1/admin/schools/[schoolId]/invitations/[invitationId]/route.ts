import { peosProxy } from "@/platform/admin/peosProxy";
export async function DELETE(request: Request, context: { params: Promise<{ schoolId: string; invitationId: string }> }) {
  const { schoolId, invitationId } = await context.params;
  return peosProxy(request, `/v1/admin/schools/${encodeURIComponent(schoolId)}/invitations/${encodeURIComponent(invitationId)}`);
}
