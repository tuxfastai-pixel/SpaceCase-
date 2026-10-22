import type { PeosGateway } from "../../platform/peos/contracts";
import type { SessionResolver } from "../../platform/session/contracts";
import type { SchoolContextRepository } from "./contracts";
import { resolveSchoolContext } from "./service";

export async function handleSchoolContextRequest(
  request: Request,
  sessionResolver: SessionResolver,
  peos: PeosGateway,
  repository: SchoolContextRepository,
  mode: "operational" | "authority_only" = "operational",
): Promise<Response> {
  const session = await sessionResolver.resolve(request);
  const result = await resolveSchoolContext(session, peos, repository, mode);

  if (!result.ok) {
    const status = result.code === "UNAUTHENTICATED" ? 401 : 403;
    return Response.json({ error: result.code }, { status, headers: {"cache-control":"no-store"} });
  }

  return Response.json({ schoolContext: result.context }, {headers:{"cache-control":"no-store"}});
}
