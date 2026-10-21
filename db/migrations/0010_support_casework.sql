CREATE TABLE support.ticket_work (
 ticket_id uuid PRIMARY KEY REFERENCES support.tickets(id),
 owner_person_id text,
 escalation_state text NOT NULL DEFAULT 'NONE' CHECK(escalation_state IN ('NONE','REQUESTED','ACKNOWLEDGED')),
 escalated_at timestamptz,
 escalation_reason text NOT NULL DEFAULT '' CHECK(char_length(escalation_reason)<=2000),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX support_work_owner_idx ON support.ticket_work(owner_person_id,ticket_id);
CREATE INDEX support_work_escalation_idx ON support.ticket_work(escalated_at,ticket_id) WHERE escalation_state='REQUESTED';
CREATE TABLE support.work_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES support.tickets(id),
 actor_person_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('CLAIM','RELEASE','REPLY','ESCALATE','ASSIGN','ACKNOWLEDGE')),
 from_owner_person_id text,to_owner_person_id text,
 note text NOT NULL CHECK(char_length(note)<=2000),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX support_work_events_ticket_idx ON support.work_events(ticket_id,created_at DESC,id DESC);
CREATE TABLE support.work_requests (
 actor_person_id text NOT NULL,request_id uuid NOT NULL,ticket_id uuid NOT NULL REFERENCES support.tickets(id),
 payload_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_person_id,request_id)
);
REVOKE ALL ON support.ticket_work,support.work_events,support.work_requests FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT SELECT,INSERT,UPDATE ON support.ticket_work TO spacecase_runtime\003B
 GRANT SELECT,INSERT ON support.work_events,support.work_requests TO spacecase_runtime\003B
 END IF\003B END\003B';
