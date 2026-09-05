import type { PeosGateway } from "../peos/contracts";
import type {
  AuthorizationDecision,
  AuthorizationPolicy,
  AuthorizationRequest,
} from "./policy";

const POLICY_VERSION = "stos-teacher-authz-v1";

export class TeacherAuthorizationPolicy implements AuthorizationPolicy {
  constructor(private readonly peos: PeosGateway) {}

  async decide(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const teacher = await this.peos.getTeacherContext(request.actorPersonId);

    if (!teacher?.active) {
      return deny("inactive_or_unknown_teacher");
    }

    if (request.schoolId && teacher.schoolId !== request.schoolId) {
      return deny("school_scope_mismatch");
    }

    if (request.classId && !teacher.classIds.includes(request.classId)) {
      return deny("class_scope_mismatch");
    }

    if (request.learnerPersonId) {
      const learner = await this.peos.getLearnerContext(
        request.learnerPersonId,
        teacher.schoolId,
      );

      if (!learner) {
        return deny("learner_not_in_school_scope");
      }

      if (learner.classId && !teacher.classIds.includes(learner.classId)) {
        return deny("learner_not_in_teacher_assignment");
      }
    }

    return {
      allowed: true,
      reason: "active_teacher_assignment",
      policyVersion: POLICY_VERSION,
    };
  }
}

function deny(reason: string): AuthorizationDecision {
  return {
    allowed: false,
    reason,
    policyVersion: POLICY_VERSION,
  };
}
