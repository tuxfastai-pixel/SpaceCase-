import type { PeosGateway, PeosLearnerContext } from "../../platform/peos/contracts";
import type { AuthenticatedSession } from "../../platform/session/contracts";
import type { LearnerProfileRepository } from "./contracts";

export type LearnerProfileResult =
  | {
      ok: true;
      profile: {
        learnerPersonId: string;
        schoolId: string;
        classId: string;
        gradeLevel?: string;
        schoolLearningProfile: {
          exists: boolean;
          profileId?: string;
          status?: "ACTIVE";
        };
      };
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "TEACHER_CONTEXT_UNAVAILABLE"
        | "TEACHER_IDENTITY_MISMATCH"
        | "LEARNER_CONTEXT_UNAVAILABLE"
        | "LEARNER_CONTEXT_MISMATCH"
        | "LEARNER_ASSIGNMENT_UNRESOLVED"
        | "LEARNER_NOT_IN_TEACHER_ASSIGNMENT";
    };

export async function resolveLearnerProfile(
  session: AuthenticatedSession | null,
  learnerPersonId: string,
  peos: PeosGateway,
  repository: LearnerProfileRepository,
): Promise<LearnerProfileResult> {
  if (!session) return { ok: false, code: "UNAUTHENTICATED" };

  const teacher = await peos.getTeacherContext(session.personId);
  if (!teacher?.active) {
    return { ok: false, code: "TEACHER_CONTEXT_UNAVAILABLE" };
  }
  if (teacher.personId !== session.personId) {
    return { ok: false, code: "TEACHER_IDENTITY_MISMATCH" };
  }

  const learner = await peos.getLearnerContext(learnerPersonId, teacher.schoolId);
  const validation = validateLearnerContext(learner, learnerPersonId, teacher.schoolId);
  if (!validation.ok) return validation;

  if (!teacher.classIds.includes(validation.learner.classId)) {
    return { ok: false, code: "LEARNER_NOT_IN_TEACHER_ASSIGNMENT" };
  }

  const localProfile = await repository.getActiveProfile(
    teacher.schoolId,
    learnerPersonId,
  );

  const localProfileMatchesAuthority =
    localProfile?.peosSchoolId === teacher.schoolId &&
    localProfile.peosLearnerPersonId === learnerPersonId &&
    localProfile.status === "ACTIVE";

  return {
    ok: true,
    profile: {
      learnerPersonId,
      schoolId: teacher.schoolId,
      classId: validation.learner.classId,
      ...(validation.learner.gradeLevel
        ? { gradeLevel: validation.learner.gradeLevel }
        : {}),
      schoolLearningProfile: localProfileMatchesAuthority
        ? {
            exists: true,
            profileId: localProfile.profileId,
            status: "ACTIVE",
          }
        : { exists: false },
    },
  };
}

function validateLearnerContext(
  learner: PeosLearnerContext | null,
  learnerPersonId: string,
  schoolId: string,
):
  | { ok: true; learner: PeosLearnerContext & { classId: string } }
  | Extract<LearnerProfileResult, { ok: false }> {
  if (!learner) return { ok: false, code: "LEARNER_CONTEXT_UNAVAILABLE" };
  if (learner.personId !== learnerPersonId || learner.schoolId !== schoolId) {
    return { ok: false, code: "LEARNER_CONTEXT_MISMATCH" };
  }
  if (!learner.classId) {
    return { ok: false, code: "LEARNER_ASSIGNMENT_UNRESOLVED" };
  }
  return { ok: true, learner: learner as PeosLearnerContext & { classId: string } };
}
