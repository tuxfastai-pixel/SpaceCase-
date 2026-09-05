import assert from "node:assert/strict";
import test from "node:test";

import { resolveLearnerProfile } from "../../domains/learner-profile/service";
import type { LearnerProfileRepository } from "../../domains/learner-profile/contracts";
import type {
  PeosConsentCheck,
  PeosGateway,
  PeosLearnerContext,
  PeosTeacherContext,
} from "../../platform/peos/contracts";
import type { AuthenticatedSession } from "../../platform/session/contracts";

class FakePeosGateway implements PeosGateway {
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

const session: AuthenticatedSession = {
  sessionId: "session-1",
  personId: "teacher-1",
  issuedAt: "2026-09-05T10:00:00.000Z",
  expiresAt: "2026-09-05T18:00:00.000Z",
};

const emptyRepository: LearnerProfileRepository = {
  async getActiveProfile() {
    return null;
  },
};

test("authorized learner without a local learning profile returns a truthful empty state", async () => {
  const result = await resolveLearnerProfile(
    session,
    "learner-1",
    new FakePeosGateway(
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
        gradeLevel: "4",
      },
    ),
    emptyRepository,
  );

  assert.deepEqual(result, {
    ok: true,
    profile: {
      learnerPersonId: "learner-1",
      schoolId: "school-1",
      classId: "class-4a",
      gradeLevel: "4",
      schoolLearningProfile: { exists: false },
    },
  });
});

test("local profile is exposed only when its PEOS identifiers match current authority", async () => {
  const repository: LearnerProfileRepository = {
    async getActiveProfile() {
      return {
        profileId: "profile-1",
        peosSchoolId: "school-2",
        peosLearnerPersonId: "learner-1",
        status: "ACTIVE",
        createdAt: "2026-09-05T10:00:00.000Z",
        updatedAt: "2026-09-05T10:00:00.000Z",
      };
    },
  };

  const result = await resolveLearnerProfile(
    session,
    "learner-1",
    new FakePeosGateway(
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
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.profile.schoolLearningProfile, { exists: false });
});

test("learner outside the teacher class assignment is denied", async () => {
  const result = await resolveLearnerProfile(
    session,
    "learner-1",
    new FakePeosGateway(
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
    emptyRepository,
  );

  assert.deepEqual(result, {
    ok: false,
    code: "LEARNER_NOT_IN_TEACHER_ASSIGNMENT",
  });
});

test("mismatched learner identity or school authority is denied", async () => {
  const result = await resolveLearnerProfile(
    session,
    "learner-1",
    new FakePeosGateway(
      {
        personId: "teacher-1",
        schoolId: "school-1",
        roleIds: ["teacher"],
        classIds: ["class-4a"],
        active: true,
      },
      {
        personId: "learner-2",
        schoolId: "school-2",
        classId: "class-4a",
      },
    ),
    emptyRepository,
  );

  assert.deepEqual(result, { ok: false, code: "LEARNER_CONTEXT_MISMATCH" });
});
