CREATE TABLE school_finance.payment_proof_worker_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),proof_id uuid NOT NULL,account_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('PROCESSED','FAILED','AUTH_DENIED')),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id)
);
CREATE INDEX payment_proof_worker_recent ON school_finance.payment_proof_worker_attempts(proof_id,created_at);
REVOKE ALL ON school_finance.payment_proof_worker_attempts FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_proof_scanner') THEN
  GRANT SELECT,INSERT ON school_finance.payment_proof_worker_attempts TO spacecase_proof_scanner;
 END IF;
END $$;
