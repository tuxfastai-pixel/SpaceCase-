import assert from "node:assert/strict";
import test from "node:test";

import { handleSchoolContextRequest } from "../../domains/school-context/http";
import type { SchoolContextRepository } from "../../domains/school-context/contracts";
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

const repository: SchoolContextRepository = {
  async getSchoolWorkspace(peosSchoolId: string) {
    return {
      peosSchoolId,
      settings: {},
    };
  },
  async getClassWorkspaces() {
    return [];
  },
};

const session: AuthenticatedSession = {
  sessionId: "session-1",
  personId: "teacher-1",
  issuedAt: "2026-09-05T10:00:00.000Z",
  expiresAt: "2026-09-05T18:00:00.000Z",
};

test("school context HTTP handler returns 401 when no authenticated PEOS session exists", async () => {
  const response = await handleSchoolContextRequest(
    new Request("https://spacecase.test/api/v1/school/context"),
    new FixedSessionResolver(null),
    new FixedPeosGateway(null),
    repository,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "UNAUTHENTICATED" });
});

test("school context HTTP handler returns bounded current school authority", async () => {
  const response = await handleSchoolContextRequest(
    new Request("https://spacecase.test/api/v1/school/context"),
    new FixedSessionResolver(session),
    new FixedPeosGateway({
      personId: "teacher-1",
      schoolId: "school-1",
      roleIds: ["teacher"],
      classIds: ["class-4a"],
      active: true,
    }),
    repository,
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schoolContext.teacherPersonId, "teacher-1");
  assert.equal(body.schoolContext.schoolId, "school-1");
  assert.deepEqual(body.schoolContext.roleIds, ["teacher"]);
  assert.deepEqual(body.schoolContext.classes, [
    {
      classId: "class-4a",
      workspaceConfigured: false,
      localSettings: {},
    },
  ]);
  assert.equal("name" in body.schoolContext, false);
  assert.equal("email" in body.schoolContext, false);
});
