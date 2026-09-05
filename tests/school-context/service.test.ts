import assert from "node:assert/strict";
import test from "node:test";

import { resolveSchoolContext } from "../../domains/school-context/service";
import type { SchoolContextRepository } from "../../domains/school-context/contracts";
import type {
  PeosConsentCheck,
  PeosGateway,
  PeosLearnerContext,
  PeosTeacherContext,
} from "../../platform/peos/contracts";
import type { AuthenticatedSession } from "../../platform/session/contracts";

class FakePeosGateway implements PeosGateway {
  constructor(private readonly teacher: PeosTeacherContext | null) {}

  async getTeacherContext(): Promise<PeosTeacherContext | null> {
    return this.teacher;
  }

  async getLearnerContext(): Promise<PeosLearnerContext | null> {
    return null;
  }

  async checkConsent(): Promise<PeosConsentCheck> {
    return { granted: false, policyVersion: "test-v1" };
  }
}

class FakeRepository implements SchoolContextRepository {
  async getSchoolWorkspace(peosSchoolId: string) {
    if (peosSchoolId !== "school-1") return null;
    return {
      peosSchoolId,
      timezone: "Africa/Johannesburg",
      academicYearLabel: "2026",
      settings: { attendanceMode: "daily" },
    };
  }

  async getClassWorkspaces(peosSchoolId: string, peosClassIds: string[]) {
    return peosClassIds
      .filter((classId) => peosSchoolId === "school-1" && classId === "class-4a")
      .map((peosClassId) => ({
        peosSchoolId,
        peosClassId,
        localSettings: { homeworkWindow: "weekly" },
      }));
  }
}

const session: AuthenticatedSession = {
  sessionId: "session-1",
  personId: "teacher-1",
  issuedAt: "2026-09-05T10:00:00.000Z",
  expiresAt: "2026-09-05T18:00:00.000Z",
};

test("school context keeps PEOS authority separate from SpaceCase operational projections", async () => {
  const result = await resolveSchoolContext(
    session,
    new FakePeosGateway({
      personId: "teacher-1",
      schoolId: "school-1",
      roleIds: ["teacher"],
      classIds: ["class-4a", "class-4b"],
      active: true,
    }),
    new FakeRepository(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.context.schoolId, "school-1");
  assert.equal(result.context.schoolWorkspace.configured, true);
  assert.deepEqual(result.context.classes, [
    {
      classId: "class-4a",
      workspaceConfigured: true,
      localSettings: { homeworkWindow: "weekly" },
    },
    {
      classId: "class-4b",
      workspaceConfigured: false,
      localSettings: {},
    },
  ]);
});

test("school context fails closed on mismatched PEOS person authority", async () => {
  const result = await resolveSchoolContext(
    session,
    new FakePeosGateway({
      personId: "teacher-2",
      schoolId: "school-1",
      roleIds: ["teacher"],
      classIds: ["class-4a"],
      active: true,
    }),
    new FakeRepository(),
  );

  assert.deepEqual(result, { ok: false, code: "TEACHER_IDENTITY_MISMATCH" });
});
