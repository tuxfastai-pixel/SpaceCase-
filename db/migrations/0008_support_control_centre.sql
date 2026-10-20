CREATE SCHEMA IF NOT EXISTS support;
REVOKE ALL ON SCHEMA support FROM PUBLIC;
CREATE TABLE IF NOT EXISTS support.tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference text NOT NULL UNIQUE DEFAULT ('SC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 requester_person_id text NOT NULL,
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 school_id text NOT NULL,
 category text NOT NULL CHECK(category IN ('BUG','EXPERIENCE','SUGGESTION')),
 impact text NOT NULL CHECK(impact IN ('BLOCKED','DEGRADED','IDEA')),
 area text NOT NULL CHECK(area IN ('DASHBOARD','ATTENDANCE','ROSTER','SCHOOL_ADMIN','OTHER')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 120),
 description text NOT NULL CHECK(char_length(description) BETWEEN 10 AND 4000),
 status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','PLANNED','RESOLVED','CLOSED')),
 priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(requester_person_id,request_id)
);
CREATE INDEX IF NOT EXISTS support_requester_time_idx ON support.tickets(requester_person_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_school_time_idx ON support.tickets(school_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_status_time_idx ON support.tickets(status,created_at DESC);
CREATE TABLE IF NOT EXISTS support.events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES support.tickets(id),
 actor_person_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('SUBMISSION','USER_REPLY','TECHNICAL_UPDATE')),
 status text NOT NULL,message text NOT NULL CHECK(char_length(message) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS support_events_ticket_time_idx ON support.events(ticket_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS support.proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES support.tickets(id),
 prepared_by text NOT NULL,summary text NOT NULL,benefit text NOT NULL,risks text NOT NULL,
 validation text NOT NULL,rollback text NOT NULL,change_url text NOT NULL DEFAULT '',
 decision text NOT NULL DEFAULT 'READY' CHECK(decision IN ('READY','APPROVED','CHANGES_REQUESTED','DEFERRED','DECLINED')),
 decision_reason text,decided_by text,decided_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS support_proposals_ticket_time_idx ON support.proposals(ticket_id,created_at DESC,id);
REVOKE ALL ON support.tickets,support.events,support.proposals FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
 GRANT USAGE ON SCHEMA support TO spacecase_runtime;
 GRANT SELECT,INSERT,UPDATE ON support.tickets TO spacecase_runtime;
 GRANT SELECT,INSERT ON support.events TO spacecase_runtime;
 GRANT SELECT,INSERT ON support.proposals TO spacecase_runtime;
 GRANT UPDATE(decision,decision_reason,decided_by,decided_at) ON support.proposals TO spacecase_runtime;
 END IF;
END $$;
