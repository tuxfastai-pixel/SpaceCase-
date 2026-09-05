import type { Pool } from "pg";

import type { AuditEvent, AuditSink } from "./contracts";

export class PostgresAuditSink implements AuditSink {
  constructor(private readonly pool: Pool) {}

  async record(event: AuditEvent): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO audit.product_audit_events (
          id,
          actor_person_id,
          action,
          resource_type,
          resource_id,
          school_id,
          learner_person_id,
          decision,
          reason,
          metadata,
          occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
      `,
      [
        event.eventId,
        event.actorPersonId,
        event.action,
        event.resourceType,
        event.resourceId ?? null,
        event.schoolId ?? null,
        event.learnerPersonId ?? null,
        event.decision ?? null,
        event.reason ?? null,
        JSON.stringify(event.metadata ?? {}),
        event.occurredAt,
      ],
    );
  }
}
