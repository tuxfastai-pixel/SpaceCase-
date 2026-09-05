import { randomUUID } from "node:crypto";

import type { AuditSink } from "../../platform/audit/contracts";
import { authorize } from "../../platform/authorization/authorize";
import { TeacherAuthorizationPolicy } from "../../platform/authorization/teacherPolicy";
import type { PeosGateway } from "../../platform/peos/contracts";
import type { SessionResolver } from "../../platform/session/contracts";
import type { InterventionRepository } from "./contracts";
import { resolveLearnerInterventions } from "./service";

export async function handleLearnerInterventionsRequest(
  request: Request,
  learnerPersonId: string,
  sessionResolver: SessionResolver,
  peos: PeosGateway,
  repository: InterventionRepository,
  audit: AuditSink,
): Promise<Response> {
  const session = await sessionResolver.resolve(request);
  if (!session) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const result = await resolveLearnerInterventions(
    session,
    learnerPersonId,
    peos,
    repository,
  );

  if (!result.ok) {
    await audit.record({
      eventId: randomUUID(),
      actorPersonId: session.personId,
      action: "learner.interventions.read",
      resourceType: "learner",
      resourceId: learnerPersonId,
      learnerPersonId,
      decision: "DENY",
      reason: result.code,
      occurredAt: new Date().toISOString(),
      metadata: { policyVersion: "stos-interventions-boundary-v1" },
    });
    return Response.json({ error: result.code }, { status: 403 });
  }

  const decision = await authorize(
    new TeacherAuthorizationPolicy(peos),
    audit,
    {
      actorPersonId: session.personId,
      action: "learner.interventions.read",
      schoolId: result.context.schoolId,
      classId: result.context.classId,
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

  return Response.json({
    learner: {
      learnerPersonId: result.context.learnerPersonId,
      schoolId: result.context.schoolId,
      classId: result.context.classId,
      interventions: result.context.interventions.map((record) => ({
        interventionId: record.interventionId,
        interventionType: record.interventionType,
        status: record.status,
        goal: record.goal,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        ...(record.completedAt ? { completedAt: record.completedAt } : {}),
      })),
    },
  });
}
