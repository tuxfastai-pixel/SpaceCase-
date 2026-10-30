-- SpaceCase owns school financial records. PEOS IDs are external references, not local identities.
-- No HTTP endpoint or automatic finance role is activated by this migration.
CREATE SCHEMA IF NOT EXISTS school_finance;

CREATE TABLE school_finance.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peos_school_id text NOT NULL UNIQUE REFERENCES school_ops.school_workspaces(peos_school_id),
  currency char(3) NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,peos_school_id)
);

CREATE TABLE school_finance.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
  peos_learner_id text NOT NULL,
  invoice_number text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','DISPUTED','VOID')),
  created_by_peos_person_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,invoice_number),
  UNIQUE(id,account_id)
);

CREATE TABLE school_finance.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
  external_reference text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  verification text NOT NULL DEFAULT 'REPORTED' CHECK (verification IN ('REPORTED','VERIFIED','REJECTED')),
  verification_evidence_ref text,
  verified_by_peos_person_id text,
  verified_at timestamptz,
  recorded_by_peos_person_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,external_reference),
  UNIQUE(id,account_id),
  CHECK (verification <> 'VERIFIED' OR
    (verification_evidence_ref IS NOT NULL AND verified_by_peos_person_id IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE TABLE school_finance.allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
  payment_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  allocated_by_peos_person_id text NOT NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (payment_id,account_id) REFERENCES school_finance.payments(id,account_id),
  FOREIGN KEY (invoice_id,account_id) REFERENCES school_finance.invoices(id,account_id),
  UNIQUE(payment_id,invoice_id)
);

CREATE TABLE school_finance.reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  prepared_by_peos_person_id text NOT NULL,
  reviewed_by_peos_person_id text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,period_start,period_end),
  CHECK (reviewed_by_peos_person_id IS NULL OR reviewed_by_peos_person_id <> prepared_by_peos_person_id),
  CHECK (status <> 'APPROVED' OR (reviewed_by_peos_person_id IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE school_finance.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES school_finance.accounts(id),
  actor_peos_person_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX finance_invoice_learner_idx ON school_finance.invoices(account_id,peos_learner_id);
CREATE INDEX finance_allocation_invoice_idx ON school_finance.allocations(account_id,invoice_id);
CREATE INDEX finance_payment_verification_idx ON school_finance.payments(account_id,verification);
CREATE INDEX finance_reconciliation_status_idx ON school_finance.reconciliations(account_id,status);
CREATE INDEX finance_audit_account_idx ON school_finance.audit_events(account_id,occurred_at);
