-- Source-only worker and cleared-file boundary; no login, job, grant or endpoint is enabled.
CREATE TABLE school_finance.payment_proof_scan_attempts (
 id uuid PRIMARY KEY,proof_id uuid NOT NULL,account_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('CLEARED','BLOCKED','FAILED')),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id),UNIQUE(id,proof_id,account_id)
);
CREATE TABLE school_finance.payment_proof_cleared (
 proof_id uuid PRIMARY KEY,account_id uuid NOT NULL,scan_id uuid NOT NULL,
 UNIQUE(proof_id,account_id),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','application/pdf')),
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),file_hash text NOT NULL CHECK(file_hash ~ '^[a-f0-9]{64}$'),
 scans jsonb NOT NULL CHECK(jsonb_typeof(scans)='array' AND jsonb_array_length(scans) BETWEEN 1 AND 2),
 policy_version text NOT NULL CHECK(length(policy_version) BETWEEN 1 AND 80),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '3650 days'),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id),
 FOREIGN KEY(scan_id,proof_id,account_id) REFERENCES school_finance.payment_proof_scan_attempts(id,proof_id,account_id)
);
CREATE TABLE school_finance.payment_proof_cleared_files (
 proof_id uuid PRIMARY KEY,account_id uuid NOT NULL,body bytea NOT NULL CHECK(octet_length(body) BETWEEN 1 AND 2097152),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cleared(proof_id,account_id)
);
CREATE INDEX payment_proof_cleared_expiry ON school_finance.payment_proof_cleared(expires_at);
CREATE TABLE school_finance.payment_proof_cleared_purges (
 proof_id uuid PRIMARY KEY,account_id uuid NOT NULL,purged_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(proof_id,account_id) REFERENCES school_finance.payment_proof_cases(id,account_id)
);
REVOKE ALL ON school_finance.payment_proof_scan_attempts,school_finance.payment_proof_cleared,school_finance.payment_proof_cleared_files,school_finance.payment_proof_cleared_purges FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT SELECT ON school_finance.payment_proof_cleared,school_finance.payment_proof_cleared_files TO spacecase_runtime;
  GRANT SELECT(id,proof_id,account_id,outcome,created_at) ON school_finance.payment_proof_scan_attempts TO spacecase_runtime;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_proof_scanner') THEN
  GRANT USAGE ON SCHEMA school_finance TO spacecase_proof_scanner;
  GRANT SELECT ON school_finance.accounts,school_finance.payment_proof_cases,school_finance.payment_proof_quarantine,school_finance.payment_proof_cleared,school_finance.payment_proof_cleared_purges TO spacecase_proof_scanner;
  GRANT SELECT,INSERT ON school_finance.payment_proof_scan_attempts TO spacecase_proof_scanner;
  GRANT INSERT ON school_finance.payment_proof_cleared,school_finance.payment_proof_cleared_files TO spacecase_proof_scanner;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_proof_cleanup') THEN
  GRANT SELECT(proof_id,account_id,expires_at) ON school_finance.payment_proof_cleared TO spacecase_proof_cleanup;
  GRANT SELECT,DELETE ON school_finance.payment_proof_cleared_files TO spacecase_proof_cleanup;
  GRANT SELECT,INSERT ON school_finance.payment_proof_cleared_purges TO spacecase_proof_cleanup;
 END IF;
END $$;
