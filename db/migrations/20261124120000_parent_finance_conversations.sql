-- Text-only private Finance discussions. No recipients, grants, messages or external sends seeded.
CREATE SCHEMA IF NOT EXISTS school_comms;
CREATE TABLE school_comms.threads (
 id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES school_finance.accounts(id),offer_id uuid NOT NULL,parent_person_id text NOT NULL,
 parent_label text NOT NULL CHECK(length(parent_label) BETWEEN 1 AND 200),learner_label text NOT NULL CHECK(length(learner_label) BETWEEN 1 AND 200),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(account_id,offer_id,parent_person_id),UNIQUE(id,account_id),
 FOREIGN KEY(offer_id,account_id) REFERENCES school_finance.activity_offers(id,account_id)
);
CREATE TABLE school_comms.messages (
 id uuid PRIMARY KEY,account_id uuid NOT NULL,thread_id uuid NOT NULL,sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 request_id uuid NOT NULL,author_person_id text NOT NULL,author_kind text NOT NULL CHECK(author_kind IN ('PARENT','STAFF')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),digest text NOT NULL CHECK(length(digest)=64),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(thread_id,account_id) REFERENCES school_comms.threads(id,account_id),UNIQUE(account_id,thread_id,request_id)
);
CREATE TABLE school_comms.reads (
 id uuid PRIMARY KEY,account_id uuid NOT NULL,thread_id uuid NOT NULL,person_id text NOT NULL,through_sequence bigint NOT NULL CHECK(through_sequence>=0),read_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(thread_id,account_id) REFERENCES school_comms.threads(id,account_id)
);
CREATE TABLE school_comms.notice_reads (
 account_id uuid NOT NULL,offer_id uuid NOT NULL,person_id text NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,offer_id,person_id),FOREIGN KEY(offer_id,account_id) REFERENCES school_finance.activity_offers(id,account_id)
);
CREATE TABLE school_comms.thread_events (
 id uuid PRIMARY KEY,sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,account_id uuid NOT NULL,thread_id uuid NOT NULL,request_id uuid NOT NULL,actor_person_id text NOT NULL,
 action text NOT NULL CHECK(action IN ('RESOLVE','REOPEN')),through_sequence bigint NOT NULL CHECK(through_sequence>=0),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(thread_id,account_id) REFERENCES school_comms.threads(id,account_id),UNIQUE(account_id,thread_id,request_id)
);
CREATE TABLE school_comms.delivery_events (
 id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES school_finance.accounts(id),kind text NOT NULL CHECK(kind IN ('ACTIVITY_OFFERED','CONVERSATION_MESSAGE')),
 resource_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(account_id,kind,resource_id)
);
CREATE INDEX conversation_messages_thread ON school_comms.messages(account_id,thread_id,sequence);
CREATE INDEX conversation_reads_person ON school_comms.reads(account_id,thread_id,person_id,through_sequence DESC);
REVOKE ALL ON ALL TABLES IN SCHEMA school_comms FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT USAGE ON SCHEMA school_comms TO spacecase_runtime;
  GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA school_comms TO spacecase_runtime;
  REVOKE SELECT ON school_comms.delivery_events FROM spacecase_runtime;
  GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA school_comms TO spacecase_runtime;
 END IF;
END $$;
