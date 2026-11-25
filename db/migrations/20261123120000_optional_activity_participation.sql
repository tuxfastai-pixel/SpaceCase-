-- An offer is school authority to charge this learner only after explicit acceptance.
-- Append-only records; no grants, invoices or decisions seeded.
CREATE TABLE school_finance.activity_offers (
 id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 activity_id uuid NOT NULL,activity_revision integer NOT NULL,learner_person_id text NOT NULL,
 offered_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(activity_id,activity_revision) REFERENCES school_finance.activity_versions(activity_id,revision),
 UNIQUE(account_id,activity_id,learner_person_id),UNIQUE(id,account_id)
);
CREATE TABLE school_finance.activity_participations (
 id uuid PRIMARY KEY,account_id uuid NOT NULL,offer_id uuid NOT NULL,actor_person_id text NOT NULL,
 grant_id uuid NOT NULL,choice text NOT NULL CHECK(choice IN ('ACCEPT','DECLINE')),
 invoice_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(offer_id,account_id) REFERENCES school_finance.activity_offers(id,account_id),
 FOREIGN KEY(invoice_id,account_id) REFERENCES school_finance.invoices(id,account_id),
 CHECK((choice='ACCEPT')=(invoice_id IS NOT NULL)),UNIQUE(account_id,offer_id),UNIQUE(account_id,invoice_id)
);
CREATE INDEX activity_offers_learner ON school_finance.activity_offers(account_id,learner_person_id);
REVOKE ALL ON school_finance.activity_offers,school_finance.activity_participations FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT SELECT,INSERT ON school_finance.activity_offers,school_finance.activity_participations TO spacecase_runtime;
 END IF;
END $$;
