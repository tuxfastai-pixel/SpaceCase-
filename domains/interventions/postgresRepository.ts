import type { Pool } from "pg";

import type {
  InterventionRecord,
  InterventionRepository,
  InterventionStatus,
  InterventionType,
} from "./contracts";

export class PostgresInterventionRepository implements InterventionRepository {
  constructor(private readonly pool: Pool) {}

  async listForLearner(
    peosSchoolId: string,
    peosLearnerPersonId: string,
  ): Promise<InterventionRecord[]> {
    const result = await this.pool.query<{
      id: string;
      peos_school_id: string;
      peos_learner_person_id: string;
      peos_class_id: string;
      intervention_type: InterventionType;
      status: InterventionStatus;
      goal: string;
      created_by_person_id: string;
      created_at: Date;
      updated_at: Date;
      completed_at: Date | null;
    }>(
      `
        SELECT
          id,
          peos_school_id,
          peos_learner_person_id,
          peos_class_id,
          intervention_type,
          status,
          goal,
          created_by_person_id,
          created_at,
          updated_at,
          completed_at
        FROM learning.interventions
        WHERE peos_school_id = $1
          AND peos_learner_person_id = $2
        ORDER BY created_at DESC, id DESC
      `,
      [peosSchoolId, peosLearnerPersonId],
    );

    return result.rows.map((row) => ({
      interventionId: row.id,
      peosSchoolId: row.peos_school_id,
      peosLearnerPersonId: row.peos_learner_person_id,
      peosClassId: row.peos_class_id,
      interventionType: row.intervention_type,
      status: row.status,
      goal: row.goal,
      createdByPersonId: row.created_by_person_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      ...(row.completed_at ? { completedAt: row.completed_at.toISOString() } : {}),
    }));
  }
}
