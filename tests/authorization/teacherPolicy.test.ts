import assert from "node:assert/strict";
import test from "node:test";

import { TeacherAuthorizationPolicy } from "../../platform/authorization/teacherPolicy";
import type {
  PeosConsentCheck,
  PeosGateway,
  PeosLearnerContext,
  PeosTeacherContext,
} from "../../platform/peos/contracts";

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
    return { granted: false, policyVersion: "test-consent-v1" };
  }
}

test("allows an active teacher assigned to the learner class", async () => {
  const policy = new TeacherAuthorizationPolicy(
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
  );

  const decision = await policy.decide({
    actorPersonId: "teacher-1",
    action: "learner.profile.read",
    schoolId: "school-1",
    learnerPersonId: "learner-1",
  });

  assert.equal(decision.allowed, true);
});

test("denies a learner outside the teacher assignment", async () => {
  const policy = new TeacherAuthorizationPolicy(
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
        schoolId: "school-1",
        classId: "class-4b",
      },
    ),
  );

  const decision = await policy.decide({
    actorPersonId: "teacher-1",
    action: "learner.profile.read",
    schoolId: "school-1",
    learnerPersonId: "learner-2",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "learner_not_in_teacher_assignment");
});

test("denies inactive teacher context", async () => {
  const policy = new TeacherAuthorizationPolicy(
    new FakePeosGateway(
      {
        personId: "teacher-1",
        schoolId: "school-1",
        roleIds: ["teacher"],
        classIds: ["class-4a"],
        active: false,
      },
      null,
    ),
  );

  const decision = await policy.decide({
    actorPersonId: "teacher-1",
    action: "learner.profile.read",
    schoolId: "school-1",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "inactive_or_unknown_teacher");
});
