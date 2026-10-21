import assert from "node:assert/strict";
import test from "node:test";

import { handleTeacherContextRequest } from "../../domains/teacher-context/http";
import type { PeosGateway, PeosTeacherContext } from "../../platform/peos/contracts";
import type { AuthenticatedSession, SessionResolver } from "../../platform/session/contracts";

class FixedSessionResolver implements SessionResolver {
  constructor(private readonly session: AuthenticatedSession | null) {}

  async resolve(): Promise<AuthenticatedSession | null> {
    return this.session;
  }
}

class StubPeosGateway implements PeosGateway {
  public teacherLookups = 0;

  constructor(private readonly teacherContext: PeosTeacherContext | null) {}

  async getTeacherContext(): Promise<PeosTeacherContext | null> {
    this.teacherLookups += 1;
    return this.teacherContext;
  }

  async getLearnerContext() {
    return null;
  }

  async checkConsent() {
    return { granted: false, policyVersion: "test-v1" };
  }
}

const session: AuthenticatedSession = {
  sessionId: "session-1",
  personId: "teacher-1",
  issuedAt: "2026-09-05T10:00:00.000Z",
  expiresAt: "2026-09-05T12:00:00.000Z",
};

const activeContext: PeosTeacherContext = {
  personId: "teacher-1",
  schoolId: "school-1",
  roleIds: ["role-1"],
  classIds: ["class-1"],
  active: true,
};

test("teacher context HTTP handler returns 401 and does not query PEOS without a session", async () => {
  const peos = new StubPeosGateway(activeContext);
  const response = await handleTeacherContextRequest(
    new Request("https://spacecase.test/api/v1/teacher/context"),
    new FixedSessionResolver(null),
    peos,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "UNAUTHENTICATED" });
  assert.equal(peos.teacherLookups, 0);
});

test("teacher context HTTP handler returns 403 when PEOS authority is unavailable", async () => {
  const response = await handleTeacherContextRequest(
    new Request("https://spacecase.test/api/v1/teacher/context"),
    new FixedSessionResolver(session),
    new StubPeosGateway(null),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "TEACHER_CONTEXT_UNAVAILABLE" });
});

test("teacher context HTTP handler returns only bounded PEOS teacher authority", async () => {
  const response = await handleTeacherContextRequest(
    new Request("https://spacecase.test/api/v1/teacher/context"),
    new FixedSessionResolver(session),
    new StubPeosGateway(activeContext),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    teacher: {
      personId: "teacher-1",
      schoolId: "school-1",
      roleIds: ["role-1"],
      classIds: ["class-1"],
    },
  });
});
