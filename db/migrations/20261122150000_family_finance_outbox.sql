CREATE TABLE school_finance.family_finance_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES school_finance.accounts(id) ON DELETE CASCADE,
 event_key text NOT NULL CHECK(length(event_key) BETWEEN 1 AND 200),kind text NOT NULL CHECK(kind IN ('PROOF_SUBMITTED','PROOF_REVIEWED','STATEMENT_READY','RECEIPT_CHANGED','ALLOCATION_CHANGED')),
 resource_type text NOT NULL,resource_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,event_key)
);
REVOKE ALL ON school_finance.family_finance_outbox FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT INSERT ON school_finance.family_finance_outbox TO spacecase_runtime;
 END IF;
END $$;
-- No dispatcher, external delivery, recipient expansion or processed flag is installed.
