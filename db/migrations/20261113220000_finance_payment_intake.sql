-- Normalized intake is evidence preparation, never verification or settlement.
CREATE TABLE school_finance.import_profiles (
 account_id uuid NOT NULL REFERENCES school_finance.accounts(id), source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 80),
 mapping jsonb NOT NULL, delimiter text NOT NULL CHECK(delimiter IN (',',';',E'\t')), decimal_separator text NOT NULL CHECK(decimal_separator IN ('.',',')),
 header_signature text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,source_key)
);
CREATE TABLE school_finance.import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 80), digest text NOT NULL CHECK(length(digest)=64),
 imported_by_peos_person_id text NOT NULL, received_count integer NOT NULL CHECK(received_count BETWEEN 1 AND 500),
 ignored_count integer NOT NULL CHECK(ignored_count>=0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,source_key,digest), UNIQUE(id,account_id)
);
CREATE TABLE school_finance.import_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES school_finance.accounts(id), batch_id uuid NOT NULL,
 row_number integer NOT NULL CHECK(row_number BETWEEN 2 AND 501), source_key text NOT NULL, transaction_date date NOT NULL,
 reference text NOT NULL CHECK(length(reference) BETWEEN 1 AND 200), source_transaction_id text CHECK(length(source_transaction_id) BETWEEN 1 AND 120),
 amount_minor bigint NOT NULL CHECK(amount_minor>0), fingerprint text NOT NULL CHECK(length(fingerprint)=64),
 status text NOT NULL CHECK(status IN ('READY','DUPLICATE_REVIEW','REPORTED','DISMISSED')),
 duplicate_kind text CHECK(duplicate_kind IN ('SOURCE_ID','FINGERPRINT')),
 payment_id uuid, review_reason text CHECK(length(review_reason) BETWEEN 1 AND 500),
 reviewed_by_peos_person_id text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(batch_id,account_id) REFERENCES school_finance.import_batches(id,account_id),
 FOREIGN KEY(payment_id,account_id) REFERENCES school_finance.payments(id,account_id),
 UNIQUE(batch_id,row_number), UNIQUE(payment_id),
 CHECK((status='REPORTED')=(payment_id IS NOT NULL))
);
CREATE INDEX finance_import_fingerprint ON school_finance.import_candidates(account_id,source_key,fingerprint);
CREATE INDEX finance_import_source_id ON school_finance.import_candidates(account_id,source_key,source_transaction_id) WHERE source_transaction_id IS NOT NULL;
CREATE INDEX finance_import_queue ON school_finance.import_candidates(account_id,created_at DESC,id DESC);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT SELECT,INSERT ON school_finance.import_profiles,school_finance.import_batches,school_finance.import_candidates TO spacecase_runtime;
  GRANT UPDATE(mapping,delimiter,decimal_separator,header_signature,updated_at) ON school_finance.import_profiles TO spacecase_runtime;
  GRANT UPDATE(status,payment_id,review_reason,reviewed_by_peos_person_id,reviewed_at) ON school_finance.import_candidates TO spacecase_runtime;
 END IF;
END $$;
