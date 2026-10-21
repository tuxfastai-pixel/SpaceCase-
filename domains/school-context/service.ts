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
        setupStatus?: "CLASS_ASSIGNMENT_REQUIRED" | "CLASSROOM_SETUP_REQUIRED";
        schoolWorkspace: {
          configured: boolean | null;
          timezone?: string;
          academicYearLabel?: string;
          settings: Record<string, unknown>;
        };
        classes: Array<{
          classId: string;
          name?:string;
          academicYear?:number|null;
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
  mode: "operational" | "authority_only" = "operational",
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

  // School membership and role are confirmed, but classroom onboarding is not
  // complete. Do not require operational storage just to acknowledge that fact.
  // null means the product workspace has not been inspected, not "configured".
  if (teacher.classIds.length === 0) {
    return { ok: true, context: {
      teacherPersonId: teacher.personId, schoolId: teacher.schoolId, roleIds: teacher.roleIds,
      setupStatus: "CLASS_ASSIGNMENT_REQUIRED", schoolWorkspace: { configured: null, settings: {} }, classes: [],
    } };
  }

  const classDetails=new Map((teacher.classes??[]).filter(c=>teacher.classIds.includes(c.id)).map(c=>[c.id,c]));
  if(mode === "authority_only") {
    return {ok:true,context:{teacherPersonId:teacher.personId,schoolId:teacher.schoolId,roleIds:teacher.roleIds,
      setupStatus:"CLASSROOM_SETUP_REQUIRED",schoolWorkspace:{configured:null,settings:{}},
      classes:teacher.classIds.map(classId=>({classId,...(classDetails.has(classId)?{name:classDetails.get(classId)!.name,academicYear:classDetails.get(classId)!.academicYear}:{}),workspaceConfigured:false,localSettings:{}}))}};
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
          ...(classDetails.has(classId)?{name:classDetails.get(classId)!.name,academicYear:classDetails.get(classId)!.academicYear}:{}),
          workspaceConfigured: Boolean(workspace),
          localSettings: workspace?.localSettings ?? {},
        };
      }),
    },
  };
}
