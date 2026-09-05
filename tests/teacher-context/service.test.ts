import assert from "node:assert/strict";
import test from "node:test";

import { resolveTeacherContext } from "../../domains/teacher-context/service";
import type { PeosGateway, PeosTeacherContext } from "../../platform/peos/contracts";
import type { AuthenticatedSession } from "../../platform/session/contracts";

class StubPeosGateway implements PeosGateway {
  constructor(private readonly teacherContext: PeosTeacherContext | null) {}

  async getTeacherContext(): Promise<PeosTeacherContext | null> {
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

test("rejects unauthenticated requests", async () => {
  const result = await resolveTeacherContext(null, new StubPeosGateway(null));
  assert.deepEqual(result, { ok: false, code: "UNAUTHENTICATED" });
});

test("rejects inactive PEOS teacher context", async () => {
  const result = await resolveTeacherContext(
    session,
    new StubPeosGateway({
      personId: "teacher-1",
      schoolId: "school-1",
      roleIds: ["teacher"],
      classIds: ["class-1"],
      active: false,
    }),
  );

  assert.deepEqual(result, { ok: false, code: "TEACHER_CONTEXT_UNAVAILABLE" });
});

test("returns active teacher context without creating local identity truth", async () => {
  const context: PeosTeacherContext = {
    personId: "teacher-1",
    schoolId: "school-1",
    roleIds: ["teacher"],
    classIds: ["class-1"],
    active: true,
  };

  const result = await resolveTeacherContext(session, new StubPeosGateway(context));

  assert.deepEqual(result, { ok: true, context });
});
