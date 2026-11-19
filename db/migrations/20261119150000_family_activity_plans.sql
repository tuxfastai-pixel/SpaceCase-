-- Explicit invoice links establish eligibility; audience text is not authority.
-- No charges, grants or accepted plans are seeded by this migration.
CREATE TABLE school_finance.activity_charge_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 activity_id uuid NOT NULL,activity_revision integer NOT NULL,invoice_id uuid NOT NULL,
 learner_person_id text NOT NULL,linked_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(activity_id,activity_revision) REFERENCES school_finance.activity_versions(activity_id,revision),
 FOREIGN KEY(invoice_id,account_id) REFERENCES school_finance.invoices(id,account_id),
 UNIQUE(account_id,invoice_id),UNIQUE(account_id,activity_id,learner_person_id)
);
CREATE TABLE school_finance.family_activity_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 learner_person_id text NOT NULL,calendar_id uuid NOT NULL,academic_year integer NOT NULL CHECK(academic_year BETWEEN 1900 AND 2200),revision integer NOT NULL CHECK(revision BETWEEN 1 AND 9999),
 actor_person_id text NOT NULL,grant_id uuid NOT NULL,request_id uuid NOT NULL,digest text NOT NULL CHECK(length(digest)=64),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),accepted_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(calendar_id,account_id) REFERENCES school_finance.activity_calendars(id,account_id),
 UNIQUE(account_id,learner_person_id,academic_year,revision),UNIQUE(account_id,request_id)
);
REVOKE ALL ON school_finance.activity_charge_links,school_finance.family_activity_plans FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT SELECT,INSERT ON school_finance.activity_charge_links,school_finance.family_activity_plans TO spacecase_runtime;
 END IF;
END $$;
