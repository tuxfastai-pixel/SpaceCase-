import assert from "node:assert/strict";
import test from "node:test";

import { handleLearnerProfileRequest } from "../../domains/learner-profile/http";
import type { LearnerProfileRepository } from "../../domains/learner-profile/contracts";
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

  async getTeacherContext(): Promise<PeosTeacherContext | null> {
    return this.teacher;
  }

  async getLearnerContext(): Promise<PeosLearnerContext | null> {
    return this.learner;
  }

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

const repository: LearnerProfileRepository = {
  async getActiveProfile() {
    return null;
  },
};

test("learner identifier alone grants no access", async () => {
  const audit = new MemoryAuditSink();
  const response = await handleLearnerProfileRequest(
    new Request("https://spacecase.test/api/v1/learners/learner-1/profile"),
    "learner-1",
    new FixedSessionResolver(null),
    new FixedPeosGateway(null, null),
    repository,
    audit,
  );

  assert.equal(response.status, 401);
  assert.equal(audit.events.length, 0);
});

test("out-of-assignment learner access is denied and audited", async () => {
  const audit = new MemoryAuditSink();
  const response = await handleLearnerProfileRequest(
    new Request("https://spacecase.test/api/v1/learners/learner-1/profile"),
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
        classId: "class-4b",
      },
    ),
    repository,
    audit,
  );

  assert.equal(response.status, 403);
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0]?.decision, "DENY");
  assert.equal(audit.events[0]?.learnerPersonId, "learner-1");
});

test("authorized response is bounded to school learning profile metadata", async () => {
  const audit = new MemoryAuditSink();
  const response = await handleLearnerProfileRequest(
    new Request("https://spacecase.test/api/v1/learners/learner-1/profile"),
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
  assert.deepEqual(body, {
    learner: {
      learnerPersonId: "learner-1",
      schoolId: "school-1",
      classId: "class-4a",
      schoolLearningProfile: { exists: false },
    },
  });
  assert.equal(JSON.stringify(body).includes("growthDNA"), false);
  assert.equal(JSON.stringify(body).includes("diagnosis"), false);
  assert.equal(JSON.stringify(body).includes("email"), false);
  assert.equal(audit.events[0]?.decision, "ALLOW");
});
