-- Additive migration; runtime activation and authority grants are separate.
ALTER TABLE school_finance.accounts ADD CONSTRAINT finance_canonical_school_id CHECK(peos_school_id=lower(peos_school_id));
ALTER TABLE school_finance.invoices ADD COLUMN description text NOT NULL DEFAULT '' CHECK(length(description)<=300);
ALTER TABLE school_finance.invoices ADD COLUMN category text NOT NULL DEFAULT 'SCHOOL_FEES';
ALTER TABLE school_finance.payments ADD COLUMN method text NOT NULL DEFAULT 'OTHER' CHECK(method IN ('EFT','CASH','CARD','OTHER'));
ALTER TABLE school_finance.payments ADD COLUMN review_reason text CHECK(length(review_reason)<=500);
ALTER TABLE school_finance.payments ADD CONSTRAINT finance_independent_payment_review
 CHECK(verification<>'VERIFIED' OR verified_by_peos_person_id<>recorded_by_peos_person_id);

CREATE TABLE school_finance.invoice_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL,invoice_id uuid NOT NULL,
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 200),quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10000),
 unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0),
 FOREIGN KEY(invoice_id,account_id) REFERENCES school_finance.invoices(id,account_id)
);
CREATE TABLE school_finance.instalments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL,invoice_id uuid NOT NULL,
 sequence integer NOT NULL CHECK(sequence BETWEEN 1 AND 60),due_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 FOREIGN KEY(invoice_id,account_id) REFERENCES school_finance.invoices(id,account_id),UNIQUE(invoice_id,sequence)
);
CREATE TABLE school_finance.budgets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 academic_year integer NOT NULL CHECK(academic_year BETWEEN 2020 AND 2200),
 category text NOT NULL CHECK(length(category) BETWEEN 1 AND 60),amount_minor bigint NOT NULL CHECK(amount_minor>0),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','REJECTED')),
 prepared_by_peos_person_id text NOT NULL,reviewed_by_peos_person_id text,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,account_id),
 CHECK(reviewed_by_peos_person_id IS NULL OR prepared_by_peos_person_id<>reviewed_by_peos_person_id),
 CHECK(status NOT IN ('APPROVED','REJECTED') OR (reviewed_by_peos_person_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX finance_budget_current_idx ON school_finance.budgets(account_id,academic_year,category) WHERE status<>'REJECTED';
CREATE TABLE school_finance.expenses(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES school_finance.accounts(id),budget_id uuid NOT NULL,
 external_reference text NOT NULL CHECK(length(external_reference) BETWEEN 1 AND 80),description text NOT NULL CHECK(length(description) BETWEEN 1 AND 300),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),evidence_reference text NOT NULL CHECK(length(evidence_reference) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','APPROVED','REJECTED')),
 prepared_by_peos_person_id text NOT NULL,reviewed_by_peos_person_id text,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,external_reference),FOREIGN KEY(budget_id,account_id) REFERENCES school_finance.budgets(id,account_id),
 CHECK(reviewed_by_peos_person_id IS NULL OR prepared_by_peos_person_id<>reviewed_by_peos_person_id),
 CHECK(status NOT IN ('APPROVED','REJECTED') OR (reviewed_by_peos_person_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
ALTER TABLE school_finance.reconciliations ADD COLUMN evidence_reference text CHECK(length(evidence_reference)<=200);
ALTER TABLE school_finance.reconciliations ADD COLUMN ledger_snapshot jsonb;
ALTER TABLE school_finance.reconciliations ADD COLUMN review_reason text CHECK(length(review_reason)<=500);
ALTER TABLE school_finance.reconciliations ADD COLUMN revision integer NOT NULL DEFAULT 1;
CREATE INDEX finance_expenses_budget_idx ON school_finance.expenses(account_id,budget_id,status);

ALTER TABLE school_finance.reconciliations ADD CONSTRAINT finance_reconciliation_account_unique UNIQUE(id,account_id);
CREATE TABLE school_finance.reconciliation_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
 reconciliation_id uuid NOT NULL,revision integer NOT NULL,
 FOREIGN KEY(reconciliation_id,account_id) REFERENCES school_finance.reconciliations(id,account_id),
 evidence_reference text NOT NULL,ledger_snapshot jsonb NOT NULL,submitted_by_peos_person_id text NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(reconciliation_id,revision)
);

-- Runtime privileges: records/audit are append-only; financial amounts cannot be overwritten.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT USAGE ON SCHEMA school_finance TO spacecase_runtime;
  GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA school_finance TO spacecase_runtime;
  GRANT UPDATE(status) ON school_finance.accounts TO spacecase_runtime;
  GRANT UPDATE(verification,verification_evidence_ref,verified_by_peos_person_id,verified_at,review_reason) ON school_finance.payments TO spacecase_runtime;
  GRANT UPDATE(status,reviewed_by_peos_person_id,reviewed_at) ON school_finance.budgets,school_finance.expenses TO spacecase_runtime;
  GRANT UPDATE(status,reviewed_by_peos_person_id,submitted_at,reviewed_at,evidence_reference,ledger_snapshot,review_reason,revision) ON school_finance.reconciliations TO spacecase_runtime;
 END IF;
END $$;
