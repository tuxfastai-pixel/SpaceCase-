import { resolveTeacherContext } from "./service";
import type { PeosGateway } from "../../platform/peos/contracts";
import type { SessionResolver } from "../../platform/session/contracts";

export async function handleTeacherContextRequest(
  request: Request,
  sessionResolver: SessionResolver,
  peos: PeosGateway,
): Promise<Response> {
  const session = await sessionResolver.resolve(request);
  const result = await resolveTeacherContext(session, peos);

  if (!result.ok) {
    const status = result.code === "UNAUTHENTICATED" ? 401 : 403;
    return Response.json({ error: result.code }, { status });
  }

  return Response.json({
    teacher: {
      personId: result.context.personId,
      schoolId: result.context.schoolId,
      roleIds: result.context.roleIds,
      classIds: result.context.classIds,
    },
  });
}
