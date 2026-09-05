import type { PeosGateway } from "../../platform/peos/contracts";
import type { AuthenticatedSession } from "../../platform/session/contracts";
import type { SchoolContextRepository } from "./contracts";

export type SchoolContextResult =
  | {
      ok: true;
      context: {
        teacherPersonId: string;
        schoolId: string;
        roleIds: string[];
        schoolWorkspace: {
          configured: boolean;
          timezone?: string;
          academicYearLabel?: string;
          settings: Record<string, unknown>;
        };
        classes: Array<{
          classId: string;
          workspaceConfigured: boolean;
          localSettings: Record<string, unknown>;
        }>;
      };
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "TEACHER_CONTEXT_UNAVAILABLE"
        | "TEACHER_IDENTITY_MISMATCH";
    };

export async function resolveSchoolContext(
  session: AuthenticatedSession | null,
  peos: PeosGateway,
  repository: SchoolContextRepository,
): Promise<SchoolContextResult> {
  if (!session) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }

  const teacher = await peos.getTeacherContext(session.personId);
  if (!teacher?.active) {
    return { ok: false, code: "TEACHER_CONTEXT_UNAVAILABLE" };
  }

  if (teacher.personId !== session.personId) {
    return { ok: false, code: "TEACHER_IDENTITY_MISMATCH" };
  }

  const [candidateSchoolWorkspace, candidateClassWorkspaces] = await Promise.all([
    repository.getSchoolWorkspace(teacher.schoolId),
    repository.getClassWorkspaces(teacher.schoolId, teacher.classIds),
  ]);

  const schoolWorkspace =
    candidateSchoolWorkspace?.peosSchoolId === teacher.schoolId
      ? candidateSchoolWorkspace
      : null;

  const assignedClassIds = new Set(teacher.classIds);
  const classWorkspaceByPeosId = new Map(
    candidateClassWorkspaces
      .filter(
        (workspace) =>
          workspace.peosSchoolId === teacher.schoolId &&
          assignedClassIds.has(workspace.peosClassId),
      )
      .map((workspace) => [workspace.peosClassId, workspace]),
  );

  return {
    ok: true,
    context: {
      teacherPersonId: teacher.personId,
      schoolId: teacher.schoolId,
      roleIds: teacher.roleIds,
      schoolWorkspace: {
        configured: Boolean(schoolWorkspace),
        ...(schoolWorkspace?.timezone ? { timezone: schoolWorkspace.timezone } : {}),
        ...(schoolWorkspace?.academicYearLabel
          ? { academicYearLabel: schoolWorkspace.academicYearLabel }
          : {}),
        settings: schoolWorkspace?.settings ?? {},
      },
      classes: teacher.classIds.map((classId) => {
        const workspace = classWorkspaceByPeosId.get(classId);
        return {
          classId,
          workspaceConfigured: Boolean(workspace),
          localSettings: workspace?.localSettings ?? {},
        };
      }),
    },
  };
}
