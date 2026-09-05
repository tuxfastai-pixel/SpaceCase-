import { randomUUID } from "node:crypto";

import type { AuditSink } from "../../platform/audit/contracts";
import { authorize } from "../../platform/authorization/authorize";
import { TeacherAuthorizationPolicy } from "../../platform/authorization/teacherPolicy";
import type { PeosGateway } from "../../platform/peos/contracts";
import type { SessionResolver } from "../../platform/session/contracts";
import type { LearnerProfileRepository } from "./contracts";
import { resolveLearnerProfile } from "./service";

export async function handleLearnerProfileRequest(
  request: Request,
  learnerPersonId: string,
  sessionResolver: SessionResolver,
  peos: PeosGateway,
  repository: LearnerProfileRepository,
  audit: AuditSink,
): Promise<Response> {
  const session = await sessionResolver.resolve(request);
  if (!session) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const result = await resolveLearnerProfile(
    session,
    learnerPersonId,
    peos,
    repository,
  );

  if (!result.ok) {
    await audit.record({
      eventId: randomUUID(),
      actorPersonId: session.personId,
      action: "learner.profile.read",
      resourceType: "learner",
      resourceId: learnerPersonId,
      learnerPersonId,
      decision: "DENY",
      reason: result.code,
      occurredAt: new Date().toISOString(),
      metadata: { policyVersion: "stos-learner-profile-boundary-v1" },
    });
    return Response.json({ error: result.code }, { status: 403 });
  }

  const decision = await authorize(
    new TeacherAuthorizationPolicy(peos),
    audit,
    {
      actorPersonId: session.personId,
      action: "learner.profile.read",
      schoolId: result.profile.schoolId,
      classId: result.profile.classId,
      learnerPersonId,
      resourceId: learnerPersonId,
    },
  );

  if (!decision.allowed) {
    return Response.json(
      { error: "FORBIDDEN", reason: decision.reason },
      { status: 403 },
    );
  }

  return Response.json({ learner: result.profile });
}
