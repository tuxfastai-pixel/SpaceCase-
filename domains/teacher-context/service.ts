import type { PeosGateway, PeosTeacherContext } from "../../platform/peos/contracts";
import type { AuthenticatedSession } from "../../platform/session/contracts";

export type TeacherContextResult =
  | { ok: true; context: PeosTeacherContext }
  | { ok: false; code: "UNAUTHENTICATED" | "TEACHER_CONTEXT_UNAVAILABLE" };

export async function resolveTeacherContext(
  session: AuthenticatedSession | null,
  peos: PeosGateway,
): Promise<TeacherContextResult> {
  if (!session) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  const context = await peos.getTeacherContext(session.personId);
  if (!context?.active) {
    return { ok: false, code: "TEACHER_CONTEXT_UNAVAILABLE" };
  }

  return { ok: true, context };
}
