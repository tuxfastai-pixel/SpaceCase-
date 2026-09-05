import type { PeosGateway } from "../../platform/peos/contracts";
import type { AuthenticatedSession } from "../../platform/session/contracts";
import type { InterventionRecord, InterventionRepository } from "./contracts";

export type LearnerInterventionsResult =
  | {
      ok: true;
      context: {
        learnerPersonId: string;
        schoolId: string;
        classId: string;
        interventions: InterventionRecord[];
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

export async function resolveLearnerInterventions(
  session: AuthenticatedSession | null,
  learnerPersonId: string,
  peos: PeosGateway,
  repository: InterventionRepository,
): Promise<LearnerInterventionsResult> {
  if (!session) return { ok: false, code: "UNAUTHENTICATED" };

  const teacher = await peos.getTeacherContext(session.personId);
  if (!teacher?.active) {
    return { ok: false, code: "TEACHER_CONTEXT_UNAVAILABLE" };
  }
  if (teacher.personId !== session.personId) {
    return { ok: false, code: "TEACHER_IDENTITY_MISMATCH" };
  }

  const learner = await peos.getLearnerContext(learnerPersonId, teacher.schoolId);
  if (!learner) return { ok: false, code: "LEARNER_CONTEXT_UNAVAILABLE" };
  if (learner.personId !== learnerPersonId || learner.schoolId !== teacher.schoolId) {
    return { ok: false, code: "LEARNER_CONTEXT_MISMATCH" };
  }
  if (!learner.classId) {
    return { ok: false, code: "LEARNER_ASSIGNMENT_UNRESOLVED" };
  }
  if (!teacher.classIds.includes(learner.classId)) {
    return { ok: false, code: "LEARNER_NOT_IN_TEACHER_ASSIGNMENT" };
  }

  const candidates = await repository.listForLearner(teacher.schoolId, learnerPersonId);
  const interventions = candidates.filter(
    (record) =>
      record.peosSchoolId === teacher.schoolId &&
      record.peosLearnerPersonId === learnerPersonId &&
      record.peosClassId === learner.classId,
  );

  return {
    ok: true,
    context: {
      learnerPersonId,
      schoolId: teacher.schoolId,
      classId: learner.classId,
      interventions,
    },
  };
}
