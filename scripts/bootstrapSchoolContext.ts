import { Client } from "pg";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalList(name: string): string[] {
  const value = process.env[name]?.trim();
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

async function run() {
  const databaseUrl = required("DATABASE_URL");
  const actorPersonId = required("ACTOR_PERSON_ID");
  const peosSchoolId = required("PEOS_SCHOOL_ID");
  const peosClassIds = optionalList("PEOS_CLASS_IDS");
  const timezone = process.env.SCHOOL_TIMEZONE?.trim() || null;
  const academicYearLabel = process.env.ACADEMIC_YEAR_LABEL?.trim() || null;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO school_ops.school_workspaces(
          peos_school_id,
          timezone,
          academic_year_label
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (peos_school_id) DO UPDATE
        SET timezone = EXCLUDED.timezone,
            academic_year_label = EXCLUDED.academic_year_label,
            status = 'ACTIVE',
            updated_at = now()
      `,
      [peosSchoolId, timezone, academicYearLabel],
    );

    for (const peosClassId of peosClassIds) {
      const classResult = await client.query(
        `
          INSERT INTO school_ops.class_workspaces(peos_school_id, peos_class_id)
          VALUES ($1, $2)
          ON CONFLICT (peos_class_id) DO UPDATE
          SET status = 'ACTIVE',
              updated_at = now()
          WHERE school_ops.class_workspaces.peos_school_id = EXCLUDED.peos_school_id
          RETURNING peos_class_id
        `,
        [peosSchoolId, peosClassId],
      );

      if ((classResult.rowCount ?? 0) !== 1) {
        throw new Error(
          `PEOS class ${peosClassId} is already bound to a different school workspace`,
        );
      }
    }

    await client.query(
      `
        INSERT INTO audit.product_audit_events(
          id,
          actor_person_id,
          action,
          resource_type,
          resource_id,
          school_id,
          decision,
          reason,
          metadata,
          occurred_at
        )
        VALUES (
          gen_random_uuid(),
          $1,
          'school_context.bootstrap',
          'SCHOOL_WORKSPACE',
          $2,
          $2,
          'ALLOW',
          'controlled_cli_bootstrap',
          $3::jsonb,
          now()
        )
      `,
      [actorPersonId, peosSchoolId, JSON.stringify({ peosClassIds })],
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        peosSchoolId,
        peosClassIds,
        workspaceConfigured: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
