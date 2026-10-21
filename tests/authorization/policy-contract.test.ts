import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuthorizationDecision,
  AuthorizationPolicy,
  AuthorizationRequest,
} from "../../platform/authorization/policy";

class DenyByDefaultPolicy implements AuthorizationPolicy {
  async decide(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    if (!request.actorPersonId || !request.action) {
      return {
        allowed: false,
        reason: "missing_required_authorization_context",
        policyVersion: "stos-authz-v1",
      };
    }

    return {
      allowed: false,
      reason: "no_explicit_grant",
      policyVersion: "stos-authz-v1",
    };
  }
}

test("authorization denies when no explicit grant exists", async () => {
  const policy = new DenyByDefaultPolicy();

  const decision = await policy.decide({
    actorPersonId: "person-teacher-1",
    action: "learner.profile.read",
    learnerPersonId: "person-learner-1",
    schoolId: "school-1",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "no_explicit_grant");
  assert.equal(decision.policyVersion, "stos-authz-v1");
});

test("knowing a learner id never creates authorization", async () => {
  const policy = new DenyByDefaultPolicy();

  const decision = await policy.decide({
    actorPersonId: "person-unassigned-1",
    action: "learner.profile.read",
    learnerPersonId: "person-learner-1",
  });

  assert.equal(decision.allowed, false);
});
