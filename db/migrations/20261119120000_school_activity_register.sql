-- School activity revisions do not create invoices, receipts or family permissions.
CREATE TABLE school_finance.activity_calendars (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 academic_year integer NOT NULL CHECK(academic_year BETWEEN 1900 AND 2200),version integer NOT NULL CHECK(version BETWEEN 1 AND 9999),
 policy jsonb NOT NULL CHECK(jsonb_typeof(policy)='object'),prepared_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,academic_year,version),UNIQUE(id,account_id)
);
CREATE TABLE school_finance.activity_versions (
 activity_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 calendar_id uuid NOT NULL,details jsonb NOT NULL CHECK(jsonb_typeof(details)='object'),
 status text NOT NULL CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','PUBLISHED','CANCELLED')),
 prepared_by text NOT NULL,actor_person_id text NOT NULL,action text NOT NULL,reason text CHECK(length(reason) BETWEEN 1 AND 500),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(activity_id,revision),FOREIGN KEY(calendar_id,account_id) REFERENCES school_finance.activity_calendars(id,account_id),
 CHECK(status NOT IN ('APPROVED','REJECTED') OR actor_person_id<>prepared_by)
);
CREATE INDEX activity_versions_account ON school_finance.activity_versions(account_id,activity_id,revision DESC);
CREATE TABLE school_finance.activity_requests (
 account_id uuid NOT NULL REFERENCES school_finance.accounts(id),request_id uuid NOT NULL,actor_person_id text NOT NULL,
 digest text NOT NULL CHECK(length(digest)=64),result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,request_id)
);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT SELECT,INSERT ON school_finance.activity_calendars,school_finance.activity_versions,school_finance.activity_requests TO spacecase_runtime;
 END IF;
END $$;
