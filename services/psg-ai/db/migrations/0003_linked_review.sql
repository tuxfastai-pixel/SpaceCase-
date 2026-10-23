-- Append-only review records, separate from lifecycle events and saved brief content.
CREATE TABLE engineering.review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES engineering.tasks(id),
 actor_id text NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 200),
 kind text NOT NULL CHECK(kind IN('PR_LINKED','DECISION_RECORDED')),
 revision integer NOT NULL CHECK(revision>0),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(task_id,revision)
);
CREATE TABLE engineering.pull_request_links (
 task_id uuid NOT NULL REFERENCES engineering.tasks(id),
 revision integer NOT NULL,
 pull_request integer NOT NULL CHECK(pull_request>0 AND pull_request<=100000000),
 head_commit text NOT NULL CHECK(head_commit ~ '^[a-f0-9]{40}$'),
 base_commit text NOT NULL CHECK(base_commit ~ '^[a-f0-9]{40}$'),
 linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(task_id,revision),
 FOREIGN KEY(task_id,revision) REFERENCES engineering.review_events(task_id,revision)
);
CREATE TABLE engineering.founder_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES engineering.tasks(id),
 actor_id text NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 200),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 reviewed_revision integer NOT NULL CHECK(reviewed_revision>=0),
 recorded_revision integer NOT NULL CHECK(recorded_revision=reviewed_revision+1),
 -- Approval is intentionally absent until all evidence adapters are connected.
 decision text NOT NULL CHECK(decision IN('CHANGES_REQUESTED','DEFERRED','DECLINED')),
 review_digest text NOT NULL CHECK(review_digest ~ '^[a-f0-9]{64}$'),
 head_commit text CHECK(head_commit ~ '^[a-f0-9]{40}$'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_id,request_id),
 UNIQUE(task_id,recorded_revision),
 FOREIGN KEY(task_id,recorded_revision) REFERENCES engineering.review_events(task_id,revision)
);
CREATE INDEX founder_decisions_task ON engineering.founder_decisions(task_id,recorded_revision DESC);
REVOKE ALL ON engineering.review_events,engineering.pull_request_links,engineering.founder_decisions FROM PUBLIC;
GRANT SELECT,INSERT ON engineering.review_events,engineering.pull_request_links,engineering.founder_decisions TO psg_engineering_runtime;
