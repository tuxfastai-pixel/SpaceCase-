import type { Pool } from "pg";

import type {
  LearnerProfileRecord,
  LearnerProfileRepository,
} from "./contracts";

export class PostgresLearnerProfileRepository implements LearnerProfileRepository {
  constructor(private readonly pool: Pool) {}

  async getActiveProfile(
    peosSchoolId: string,
    peosLearnerPersonId: string,
  ): Promise<LearnerProfileRecord | null> {
    const result = await this.pool.query<{
      id: string;
      peos_school_id: string;
      peos_learner_person_id: string;
      status: "ACTIVE" | "ARCHIVED";
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, peos_school_id, peos_learner_person_id, status, created_at, updated_at
        FROM learning.learner_profiles
        WHERE peos_school_id = $1
          AND peos_learner_person_id = $2
          AND status = 'ACTIVE'
        LIMIT 1
      `,
      [peosSchoolId, peosLearnerPersonId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      profileId: row.id,
      peosSchoolId: row.peos_school_id,
      peosLearnerPersonId: row.peos_learner_person_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
