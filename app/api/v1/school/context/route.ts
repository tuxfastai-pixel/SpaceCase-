import { handleSchoolContextRequest } from "../../../../../domains/school-context/http";
import { PostgresSchoolContextRepository } from "../../../../../domains/school-context/postgresRepository";
import { readServerEnvironment } from "../../../../../platform/config/env";
import { getDatabasePool } from "../../../../../platform/db/pool";
import { HttpPeosGateway } from "../../../../../platform/peos/httpGateway";
import { resolvePeosAuthorization } from "../../../../../platform/session/peosAuthorization";
import { PeosSessionResolver } from "../../../../../platform/session/peosSessionResolver";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const environment = readServerEnvironment();
  if (!environment.PEOS_BASE_URL) {
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }

  const authorization = resolvePeosAuthorization(request);
  if (!authorization) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const sessionResolver = new PeosSessionResolver(environment.PEOS_BASE_URL);
  const peos = new HttpPeosGateway(environment.PEOS_BASE_URL, authorization);
  const repository = new PostgresSchoolContextRepository(getDatabasePool());

  try {
    return await handleSchoolContextRequest(request, sessionResolver, peos, repository);
  } catch {
    return Response.json({ error: "SCHOOL_CONTEXT_UNAVAILABLE" }, { status: 503 });
  }
}
