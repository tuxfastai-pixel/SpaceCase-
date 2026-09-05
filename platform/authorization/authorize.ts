import { randomUUID } from "node:crypto";

import type { AuditSink } from "../audit/contracts";
import type {
  AuthorizationDecision,
  AuthorizationPolicy,
  AuthorizationRequest,
} from "./policy";

export async function authorize(
  policy: AuthorizationPolicy,
  audit: AuditSink,
  request: AuthorizationRequest,
): Promise<AuthorizationDecision> {
  const decision = await policy.decide(request);

  await audit.record({
    eventId: randomUUID(),
    actorPersonId: request.actorPersonId,
    action: request.action,
    resourceType: inferResourceType(request),
    resourceId: request.resourceId,
    schoolId: request.schoolId,
    learnerPersonId: request.learnerPersonId,
    decision: decision.allowed ? "ALLOW" : "DENY",
    reason: decision.reason,
    occurredAt: new Date().toISOString(),
    metadata: {
      policyVersion: decision.policyVersion,
    },
  });

  return decision;
}

function inferResourceType(request: AuthorizationRequest): string {
  if (request.learnerPersonId) return "learner";
  if (request.classId) return "class";
  if (request.schoolId) return "school";
  return "spacecase";
}
