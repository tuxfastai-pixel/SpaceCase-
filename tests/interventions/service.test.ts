import assert from "node:assert/strict";
import test from "node:test";

import { resolveLearnerInterventions } from "../../domains/interventions/service";
import type { InterventionRepository } from "../../domains/interventions/contracts";
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
  async getTeacherContext() { return this.teacher; }
  async getLearnerContext() { return this.learner; }
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

test("intervention list returns only records within current PEOS learner class scope", async () => {
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
          goal: "Practice number bonds during guided mathematics sessions.",
          createdByPersonId: "teacher-1",
          createdAt: "2026-09-05T10:00:00.000Z",
          updatedAt: "2026-09-05T10:00:00.000Z",
        },
        {
          interventionId: "intervention-out-of-scope",
          peosSchoolId: "school-1",
          peosLearnerPersonId: "learner-1",
          peosClassId: "class-4b",
          interventionType: "HOMEWORK_SUPPORT",
          status: "DRAFT",
          goal: "Should not be exposed after class reassignment.",
          createdByPersonId: "teacher-2",
          createdAt: "2026-09-05T10:00:00.000Z",
          updatedAt: "2026-09-05T10:00:00.000Z",
        },
      ];
    },
  };

  const result = await resolveLearnerInterventions(
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
  assert.deepEqual(result.context.interventions.map((item) => item.interventionId), ["intervention-1"]);
});

test("interventions deny a learner outside the teacher assignment", async () => {
  const repository: InterventionRepository = { async listForLearner() { return []; } };
  const result = await resolveLearnerInterventions(
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
    repository,
  );

  assert.deepEqual(result, { ok: false, code: "LEARNER_NOT_IN_TEACHER_ASSIGNMENT" });
});
