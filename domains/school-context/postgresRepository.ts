import type { Pool } from "pg";

import type {
  ClassWorkspaceProjection,
  SchoolContextRepository,
  SchoolWorkspaceProjection,
} from "./contracts";

export class PostgresSchoolContextRepository implements SchoolContextRepository {
  constructor(private readonly pool: Pool) {}

  async getSchoolWorkspace(peosSchoolId: string): Promise<SchoolWorkspaceProjection | null> {
    const result = await this.pool.query<{
      peos_school_id: string;
      timezone: string | null;
      academic_year_label: string | null;
      settings: Record<string, unknown>;
    }>(
      `
        SELECT peos_school_id, timezone, academic_year_label, settings
        FROM school_ops.school_workspaces
        WHERE peos_school_id = $1
          AND status = 'ACTIVE'
        LIMIT 1
      `,
      [peosSchoolId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      peosSchoolId: row.peos_school_id,
      ...(row.timezone ? { timezone: row.timezone } : {}),
      ...(row.academic_year_label ? { academicYearLabel: row.academic_year_label } : {}),
      settings: row.settings ?? {},
    };
  }

  async getClassWorkspaces(
    peosSchoolId: string,
    peosClassIds: string[],
  ): Promise<ClassWorkspaceProjection[]> {
    if (peosClassIds.length === 0) return [];

    const result = await this.pool.query<{
      peos_school_id: string;
      peos_class_id: string;
      local_settings: Record<string, unknown>;
    }>(
      `
        SELECT peos_school_id, peos_class_id, local_settings
        FROM school_ops.class_workspaces
        WHERE peos_school_id = $1
          AND peos_class_id = ANY($2::text[])
          AND status = 'ACTIVE'
        ORDER BY peos_class_id
      `,
      [peosSchoolId, peosClassIds],
    );

    return result.rows.map((row) => ({
      peosSchoolId: row.peos_school_id,
      peosClassId: row.peos_class_id,
      localSettings: row.local_settings ?? {},
    }));
  }
}
