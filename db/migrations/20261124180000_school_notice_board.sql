-- Operational correspondence; canonical family/class authority stays in PEOS.
CREATE SCHEMA school_board;
CREATE TABLE school_board.notices (
 id uuid PRIMARY KEY,school_id uuid NOT NULL,author_person_id uuid NOT NULL,request_id uuid NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
 class_id uuid,class_label text,school_label text NOT NULL,replies_allowed boolean NOT NULL,digest text NOT NULL,
 published_at timestamptz NOT NULL DEFAULT now(),UNIQUE(school_id,author_person_id,request_id)
);
CREATE TABLE school_board.recipients (
 thread_id uuid PRIMARY KEY,notice_id uuid NOT NULL REFERENCES school_board.notices(id),parent_person_id uuid NOT NULL,
 relationship_ids uuid[] NOT NULL CHECK(cardinality(relationship_ids)>0),parent_label text NOT NULL,learner_labels jsonb NOT NULL,
 UNIQUE(notice_id,parent_person_id),UNIQUE(thread_id,notice_id)
);
CREATE TABLE school_board.messages (
 id uuid PRIMARY KEY,sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,thread_id uuid NOT NULL REFERENCES school_board.recipients(thread_id),
 request_id uuid NOT NULL,author_person_id uuid NOT NULL,author_kind text NOT NULL CHECK(author_kind IN ('PARENT','STAFF')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),digest text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(thread_id,request_id)
);
CREATE TABLE school_board.reads (
 id uuid PRIMARY KEY,thread_id uuid NOT NULL REFERENCES school_board.recipients(thread_id),actor_person_id uuid NOT NULL,actor_kind text NOT NULL CHECK(actor_kind IN ('PARENT','STAFF')),
 through_sequence bigint NOT NULL CHECK(through_sequence>=0),read_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE school_board.events (
 id uuid PRIMARY KEY,sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,notice_id uuid NOT NULL REFERENCES school_board.notices(id),thread_id uuid,actor_person_id uuid NOT NULL,
 request_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('WITHDRAW','RESOLVE','REOPEN')),through_sequence bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(notice_id,actor_person_id,request_id),CHECK((action='WITHDRAW')=(thread_id IS NULL)),FOREIGN KEY(thread_id,notice_id) REFERENCES school_board.recipients(thread_id,notice_id)
);
CREATE TABLE school_board.audit (
 id uuid PRIMARY KEY,school_id uuid NOT NULL,actor_person_id uuid NOT NULL,action text NOT NULL,resource_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX board_notices_school ON school_board.notices(school_id,published_at DESC,id);
CREATE INDEX board_recipients_parent ON school_board.recipients(parent_person_id,notice_id);
CREATE INDEX board_messages_thread ON school_board.messages(thread_id,sequence);
CREATE INDEX board_reads_actor ON school_board.reads(thread_id,actor_person_id,through_sequence DESC);
REVOKE ALL ON ALL TABLES IN SCHEMA school_board FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
 GRANT USAGE ON SCHEMA school_board TO spacecase_runtime;
 GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA school_board TO spacecase_runtime;
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA school_board TO spacecase_runtime;
END IF; END $$;
