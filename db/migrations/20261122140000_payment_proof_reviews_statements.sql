CREATE TABLE school_finance.payment_proof_reviews (
 id uuid PRIMARY KEY,proof_id uuid NOT NULL,account_id uuid NOT NULL,revision integer NOT NULL CHECK(revision BETWEEN 1 AND 9999),
 actor_person_id text NOT NULL,status text NOT NULL CHECK(status IN ('NEEDS_INFORMATION','REJECTED','LINKED')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),payment_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='LINKED')=(payment_id IS NOT NULL)),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id),
 FOREIGN KEY(payment_id,account_id) REFERENCES school_finance.payments(id,account_id),
 UNIQUE(proof_id,revision),UNIQUE(account_id,payment_id),UNIQUE(id,account_id)
);
CREATE TABLE school_finance.payment_proof_review_requests (
 account_id uuid NOT NULL,request_id uuid NOT NULL,actor_person_id text NOT NULL,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),review_id uuid NOT NULL,
 PRIMARY KEY(account_id,request_id),FOREIGN KEY(review_id,account_id) REFERENCES school_finance.payment_proof_reviews(id,account_id)
);
CREATE TABLE school_finance.family_statement_snapshots (
 id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES school_finance.accounts(id),learner_person_id text NOT NULL,actor_person_id text NOT NULL,
 request_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 UNIQUE(account_id,actor_person_id,request_id)
);
REVOKE ALL ON school_finance.payment_proof_reviews,school_finance.payment_proof_review_requests,school_finance.family_statement_snapshots FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT SELECT,INSERT ON school_finance.payment_proof_reviews,school_finance.payment_proof_review_requests,school_finance.family_statement_snapshots TO spacecase_runtime;
 END IF;
END $$;
