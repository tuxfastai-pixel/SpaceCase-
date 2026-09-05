import { handleLearnerProfileRequest } from "../../../../../../../domains/learner-profile/http";
import { PostgresLearnerProfileRepository } from "../../../../../../../domains/learner-profile/postgresRepository";
import { PostgresAuditSink } from "../../../../../../../platform/audit/postgresAuditSink";
import { readServerEnvironment } from "../../../../../../../platform/config/env";
import { getDatabasePool } from "../../../../../../../platform/db/pool";
import { HttpPeosGateway } from "../../../../../../../platform/peos/httpGateway";
import { resolvePeosAuthorization } from "../../../../../../../platform/session/peosAuthorization";
import { PeosSessionResolver } from "../../../../../../../platform/session/peosSessionResolver";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ learnerPersonId: string }> },
): Promise<Response> {
  const environment = readServerEnvironment();
  if (!environment.PEOS_BASE_URL) {
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }

  const authorization = resolvePeosAuthorization(request);
  if (!authorization) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { learnerPersonId } = await context.params;
  const pool = getDatabasePool();
  const sessionResolver = new PeosSessionResolver(environment.PEOS_BASE_URL);
  const peos = new HttpPeosGateway(environment.PEOS_BASE_URL, authorization);
  const repository = new PostgresLearnerProfileRepository(pool);
  const audit = new PostgresAuditSink(pool);

  try {
    return await handleLearnerProfileRequest(
      request,
      learnerPersonId,
      sessionResolver,
      peos,
      repository,
      audit,
    );
  } catch {
    return Response.json({ error: "LEARNER_PROFILE_UNAVAILABLE" }, { status: 503 });
  }
}
