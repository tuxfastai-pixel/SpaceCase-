-- PSG-owned store. Apply only to a dedicated engineering database, never the product database.
CREATE SCHEMA engineering;
REVOKE ALL ON SCHEMA engineering FROM PUBLIC;
CREATE TABLE engineering.tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project text NOT NULL CHECK(project='SPACECASE'),
 repository text NOT NULL CHECK(repository='tuxfastai-pixel/SpaceCase-'),
 source_reference text NOT NULL CHECK(source_reference ~ '^SC-[A-F0-9]{12}$'),
 source_revision integer NOT NULL CHECK(source_revision>=0),
 handoff_digest text NOT NULL CHECK(handoff_digest ~ '^[a-f0-9]{64}$'),
 base_commit text NOT NULL CHECK(base_commit ~ '^[a-f0-9]{40}$'),
 handoff jsonb NOT NULL CHECK(jsonb_typeof(handoff)='object' AND octet_length(handoff::text)<=20000),
 created_by text NOT NULL CHECK(length(created_by) BETWEEN 1 AND 200),
 state text NOT NULL DEFAULT 'BLOCKED' CHECK(state IN('BLOCKED','CANCELLED')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 cancelled_at timestamptz,
 CHECK((state='CANCELLED')=(cancelled_at IS NOT NULL)),
 UNIQUE(project,source_reference,source_revision,handoff_digest,base_commit)
);
CREATE TABLE engineering.requests (
 actor_id text NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 200),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 task_id uuid NOT NULL REFERENCES engineering.tasks(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE engineering.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES engineering.tasks(id),
 actor_id text NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 200),
 kind text NOT NULL CHECK(kind IN('CREATED','CANCELLED')),
 revision integer NOT NULL CHECK(revision>=0),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(task_id,revision)
);
CREATE INDEX tasks_recent ON engineering.tasks(created_at DESC,id);
CREATE INDEX requests_task ON engineering.requests(task_id);
CREATE INDEX events_task ON engineering.events(task_id,occurred_at,id);
REVOKE ALL ON ALL TABLES IN SCHEMA engineering FROM PUBLIC;
-- The deployment operator creates this isolated, non-owner role before migration.
GRANT USAGE ON SCHEMA engineering TO psg_engineering_runtime;
GRANT SELECT,INSERT ON engineering.tasks,engineering.requests,engineering.events TO psg_engineering_runtime;
GRANT UPDATE(state,revision,cancelled_at) ON engineering.tasks TO psg_engineering_runtime;
