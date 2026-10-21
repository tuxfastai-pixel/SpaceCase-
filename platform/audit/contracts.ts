export type AuditEvent = {
  eventId: string;
  actorPersonId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  schoolId?: string;
  learnerPersonId?: string;
  decision?: "ALLOW" | "DENY";
  reason?: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}
