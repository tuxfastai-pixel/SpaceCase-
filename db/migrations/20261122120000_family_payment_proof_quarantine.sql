-- Receiving foundation only: no public route, clean-file state or ledger mutation.
CREATE TABLE school_finance.payment_proof_cases (
 id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 learner_person_id text NOT NULL,actor_person_id text NOT NULL,grant_id uuid NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),file_hash text NOT NULL CHECK(file_hash ~ '^[a-f0-9]{64}$'),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','application/pdf')),
 file_size integer NOT NULL CHECK(file_size BETWEEN 1 AND 2097152),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),paid_on date NOT NULL,
 payment_reference text NOT NULL CHECK(length(payment_reference) BETWEEN 1 AND 160),
 method text NOT NULL CHECK(method IN ('EFT','CASH_DEPOSIT','OTHER')),
 policy_version text NOT NULL CHECK(length(policy_version) BETWEEN 1 AND 80),
 received_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 CHECK(expires_at>received_at AND expires_at<=received_at+interval '72 hours'),
 UNIQUE(id,account_id),UNIQUE(account_id,actor_person_id,learner_person_id,file_hash)
);
CREATE INDEX payment_proof_case_owner ON school_finance.payment_proof_cases(account_id,actor_person_id,learner_person_id,received_at);
CREATE INDEX payment_proof_case_quota ON school_finance.payment_proof_cases(account_id,received_at);
CREATE TABLE school_finance.payment_proof_requests (
 account_id uuid NOT NULL,actor_person_id text NOT NULL,request_id uuid NOT NULL,
 proof_id uuid NOT NULL,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,actor_person_id,request_id),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id)
);
CREATE TABLE school_finance.payment_proof_quarantine (
 proof_id uuid PRIMARY KEY,account_id uuid NOT NULL,body bytea NOT NULL CHECK(octet_length(body) BETWEEN 1 AND 2097152),
 expires_at timestamptz NOT NULL,
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id)
);
CREATE INDEX payment_proof_quarantine_expiry ON school_finance.payment_proof_quarantine(expires_at);
CREATE TABLE school_finance.payment_proof_purges (
 proof_id uuid PRIMARY KEY,account_id uuid NOT NULL,purged_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id)
);
REVOKE ALL ON school_finance.payment_proof_cases,school_finance.payment_proof_requests,school_finance.payment_proof_quarantine,school_finance.payment_proof_purges FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT SELECT,INSERT ON school_finance.payment_proof_cases,school_finance.payment_proof_requests TO spacecase_runtime;
  GRANT INSERT ON school_finance.payment_proof_quarantine TO spacecase_runtime;
  -- Ordinary web runtime cannot read or delete the raw quarantined bytes.
  REVOKE SELECT,UPDATE,DELETE ON school_finance.payment_proof_quarantine FROM spacecase_runtime;
 END IF;
 -- The independently provisioned cleanup role is not created or assigned here.
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_proof_cleanup') THEN
  GRANT USAGE ON SCHEMA school_finance TO spacecase_proof_cleanup;
  GRANT SELECT,DELETE ON school_finance.payment_proof_quarantine TO spacecase_proof_cleanup;
  GRANT SELECT,INSERT ON school_finance.payment_proof_purges TO spacecase_proof_cleanup;
 END IF;
END $$;
