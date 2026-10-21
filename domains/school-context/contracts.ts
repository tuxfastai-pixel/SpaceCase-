export type SchoolWorkspaceProjection = {
  peosSchoolId: string;
  timezone?: string;
  academicYearLabel?: string;
  settings: Record<string, unknown>;
};

export type ClassWorkspaceProjection = {
  peosSchoolId: string;
  peosClassId: string;
  localSettings: Record<string, unknown>;
};

export interface SchoolContextRepository {
  getSchoolWorkspace(peosSchoolId: string): Promise<SchoolWorkspaceProjection | null>;
  getClassWorkspaces(
    peosSchoolId: string,
    peosClassIds: string[],
  ): Promise<ClassWorkspaceProjection[]>;
}
