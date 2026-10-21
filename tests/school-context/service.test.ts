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

test("a school-connected teacher without classes receives onboarding without opening product storage", async () => {
  const repository: SchoolContextRepository = {
    async getSchoolWorkspace() { throw new Error("Operational database is not ready"); },
    async getClassWorkspaces() { throw new Error("Must not load classroom records"); },
  };
  const peos = new FakePeosGateway({ personId: session.personId, schoolId: "school-1", roleIds: ["teacher"], classIds: [], active: true });
  const result = await resolveSchoolContext(session, peos, repository);
  assert.deepEqual(result, { ok: true, context: { teacherPersonId: session.personId, schoolId: "school-1", roleIds: ["teacher"],
    setupStatus: "CLASS_ASSIGNMENT_REQUIRED", schoolWorkspace: { configured: null, settings: {} }, classes: [] } });
  assert.deepEqual(await resolveSchoolContext(null, peos, repository), { ok: false, code: "UNAUTHENTICATED" });
  const mismatch = new FakePeosGateway({ personId: "other-person", schoolId: "school-1", roleIds: ["teacher"], classIds: [], active: true });
  assert.deepEqual(await resolveSchoolContext(session, mismatch, repository), { ok: false, code: "TEACHER_IDENTITY_MISMATCH" });
});

test("assigned teachers still fail closed when operational storage is unavailable", async () => {
  const repository: SchoolContextRepository = {
    async getSchoolWorkspace() { throw new Error("Operational database is not ready"); },
    async getClassWorkspaces() { return []; },
  };
  await assert.rejects(resolveSchoolContext(session, new FakePeosGateway({ personId: session.personId,
    schoolId: "school-1", roleIds: ["teacher"], classIds: ["class-1"], active: true }), repository), /Operational database is not ready/);
});

test("explicit school setup mode displays only PEOS-assigned classes and does not open learning storage",async()=>{
  const repository:SchoolContextRepository={async getSchoolWorkspace(){throw new Error("Must not open storage");},async getClassWorkspaces(){throw new Error("Must not open storage");}};
  const teacher:PeosTeacherContext={personId:session.personId,schoolId:"school-1",roleIds:["teacher"],classIds:["class-1"],active:true,
    classes:[{id:"class-1",name:"Grade 2C",academicYear:2026},{id:"unassigned",name:"Private class",academicYear:2026}]};
  const result=await resolveSchoolContext(session,new FakePeosGateway(teacher),repository,"authority_only");
  assert.equal(result.ok,true);if(!result.ok)return;
  assert.equal(result.context.setupStatus,"CLASSROOM_SETUP_REQUIRED");
  assert.equal(result.context.schoolWorkspace.configured,null);
  assert.deepEqual(result.context.classes,[{classId:"class-1",name:"Grade 2C",academicYear:2026,workspaceConfigured:false,localSettings:{}}]);
  assert.deepEqual(await resolveSchoolContext(null,new FakePeosGateway(teacher),repository,"authority_only"),{ok:false,code:"UNAUTHENTICATED"});
});

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

test("school context ignores local projections outside the PEOS school and class authority", async () => {
  const repository: SchoolContextRepository = {
    async getSchoolWorkspace() {
      return {
        peosSchoolId: "school-2",
        settings: { unsafe: true },
      };
    },
    async getClassWorkspaces() {
      return [
        {
          peosSchoolId: "school-2",
          peosClassId: "class-4a",
          localSettings: { unsafe: true },
        },
        {
          peosSchoolId: "school-1",
          peosClassId: "class-not-assigned",
          localSettings: { unsafe: true },
        },
      ];
    },
  };

  const result = await resolveSchoolContext(
    session,
    new FakePeosGateway({
      personId: "teacher-1",
      schoolId: "school-1",
      roleIds: ["teacher"],
      classIds: ["class-4a"],
      active: true,
    }),
    repository,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.context.schoolWorkspace, {
    configured: false,
    settings: {},
  });
  assert.deepEqual(result.context.classes, [
    {
      classId: "class-4a",
      workspaceConfigured: false,
      localSettings: {},
    },
  ]);
});
