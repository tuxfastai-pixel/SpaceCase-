import assert from "node:assert/strict";
import test from "node:test";

import type { AuditEvent, AuditSink } from "../../platform/audit/contracts";
import { authorize } from "../../platform/authorization/authorize";
import type {
  AuthorizationDecision,
  AuthorizationPolicy,
  AuthorizationRequest,
} from "../../platform/authorization/policy";

class FixedPolicy implements AuthorizationPolicy {
  constructor(private readonly decision: AuthorizationDecision) {}

  async decide(_request: AuthorizationRequest): Promise<AuthorizationDecision> {
    return this.decision;
  }
}

class MemoryAuditSink implements AuditSink {
  events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

test("records a deny decision with actor and learner context", async () => {
  const audit = new MemoryAuditSink();
  const policy = new FixedPolicy({
    allowed: false,
    reason: "learner_not_in_teacher_assignment",
    policyVersion: "stos-teacher-authz-v1",
  });

  const decision = await authorize(policy, audit, {
    actorPersonId: "teacher-1",
    action: "learner.profile.read",
    schoolId: "school-1",
    learnerPersonId: "learner-2",
  });

  assert.equal(decision.allowed, false);
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0]?.decision, "DENY");
  assert.equal(audit.events[0]?.actorPersonId, "teacher-1");
  assert.equal(audit.events[0]?.learnerPersonId, "learner-2");
  assert.equal(audit.events[0]?.metadata?.policyVersion, "stos-teacher-authz-v1");
});
