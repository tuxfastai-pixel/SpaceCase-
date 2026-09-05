import assert from "node:assert/strict";
import test from "node:test";

import { handleLearnerInterventionsRequest } from "../../domains/interventions/http";
import type { InterventionRepository } from "../../domains/interventions/contracts";
import type { AuditEvent, AuditSink } from "../../platform/audit/contracts";
import type {
  PeosConsentCheck,
  PeosGateway,
  PeosLearnerContext,
  PeosTeacherContext,
} from "../../platform/peos/contracts";
import type {
  AuthenticatedSession,
  SessionResolver,
} from "../../platform/session/contracts";

class FixedSessionResolver implements SessionResolver {
  constructor(private readonly session: AuthenticatedSession | null) {}
  async resolve(): Promise<AuthenticatedSession | null> {
    return this.session;
  }
}

class FixedPeosGateway implements PeosGateway {
  constructor(
    private readonly teacher: PeosTeacherContext | null,
    private readonly learner: PeosLearnerContext | null,
  ) {}
  async getTeacherContext() { return this.teacher; }
  async getLearnerContext() { return this.learner; }
  async checkConsent(): Promise<PeosConsentCheck> {
    return { granted: false, policyVersion: "test-v1" };
  }
}

class MemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

const session: AuthenticatedSession = {
  sessionId: "session-1",
  personId: "teacher-1",
  issuedAt: "2026-09-05T10:00:00.000Z",
  expiresAt: "2026-09-05T18:00:00.000Z",
};

const repository: InterventionRepository = {
  async listForLearner() {
    return [
      {
        interventionId: "intervention-1",
        peosSchoolId: "school-1",
        peosLearnerPersonId: "learner-1",
        peosClassId: "class-4a",
        interventionType: "INSTRUCTIONAL_SUPPORT",
        status: "ACTIVE",
        goal: "Use guided reading practice twice weekly.",
        createdByPersonId: "teacher-1",
        createdAt: "2026-09-05T10:00:00.000Z",
        updatedAt: "2026-09-05T11:00:00.000Z",
      },
    ];
  },
};

test("learner intervention route requires an authenticated session", async () => {
  const audit = new MemoryAuditSink();
  const response = await handleLearnerInterventionsRequest(
    new Request("https://spacecase.test/api/v1/learners/learner-1/interventions"),
    "learner-1",
    new FixedSessionResolver(null),
    new FixedPeosGateway(null, null),
    repository,
    audit,
  );

  assert.equal(response.status, 401);
  assert.equal(audit.events.length, 0);
});

test("authorized intervention response omits creator identity and developmental fields", async () => {
  const audit = new MemoryAuditSink();
  const response = await handleLearnerInterventionsRequest(
    new Request("https://spacecase.test/api/v1/learners/learner-1/interventions"),
    "learner-1",
    new FixedSessionResolver(session),
    new FixedPeosGateway(
      {
        personId: "teacher-1",
        schoolId: "school-1",
        roleIds: ["teacher"],
        classIds: ["class-4a"],
        active: true,
      },
      {
        personId: "learner-1",
        schoolId: "school-1",
        classId: "class-4a",
      },
    ),
    repository,
    audit,
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("createdByPersonId"), false);
  assert.equal(serialized.includes("growthDNA"), false);
  assert.equal(serialized.includes("diagnosis"), false);
  assert.equal(body.learner.interventions[0].goal, "Use guided reading practice twice weekly.");
  assert.equal(audit.events[0]?.decision, "ALLOW");
});
