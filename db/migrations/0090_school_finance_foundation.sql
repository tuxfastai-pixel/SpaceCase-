-- SpaceCase owns financial records; PEOS IDs are external references, never local identities.
-- No finance API or permissions are activated by this migration.
CREATE SCHEMA IF NOT EXISTS school_finance;
REVOKE ALL ON SCHEMA school_finance FROM PUBLIC;

CREATE TABLE school_finance.accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 currency text NOT NULL DEFAULT 'ZAR' CHECK(currency='ZAR'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,peos_school_id),
 UNIQUE(peos_school_id,name)
);
CREATE TABLE school_finance.invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 account_id uuid NOT NULL,
 learner_person_id text NOT NULL,
 invoice_number text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','DISPUTED','VOID')),
 due_date date NOT NULL,
 created_by_person_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,peos_school_id) REFERENCES school_finance.accounts(id,peos_school_id),
 UNIQUE(id,peos_school_id,account_id),
 UNIQUE(peos_school_id,invoice_number)
);
CREATE TABLE school_finance.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 account_id uuid NOT NULL,
 external_reference text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 verification text NOT NULL DEFAULT 'REPORTED' CHECK(verification IN ('REPORTED','VERIFIED','REJECTED')),
 received_at timestamptz NOT NULL,
 verified_by_person_id text,
 verified_at timestamptz,
 recorded_by_person_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,peos_school_id) REFERENCES school_finance.accounts(id,peos_school_id),
 UNIQUE(id,peos_school_id,account_id),
 UNIQUE(peos_school_id,account_id,external_reference),
 CHECK ((verification='VERIFIED' AND verified_by_person_id IS NOT NULL AND verified_at IS NOT NULL)
     OR (verification<>'VERIFIED' AND verified_by_person_id IS NULL AND verified_at IS NULL))
);
CREATE TABLE school_finance.allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 peos_school_id text NOT NULL,
 account_id uuid NOT NULL,
 payment_id uuid NOT NULL,
 invoice_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 allocated_by_person_id text NOT NULL,
 allocated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(payment_id,peos_school_id,account_id) REFERENCES school_finance.payments(id,peos_school_id,account_id),
 FOREIGN KEY(invoice_id,peos_school_id,account_id) REFERENCES school_finance.invoices(id,peos_school_id,account_id),
 UNIQUE(payment_id,invoice_id)
);
CREATE TABLE school_finance.reconciliations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 account_id uuid NOT NULL,
 period_start date NOT NULL,
 period_end date NOT NULL CHECK(period_end>=period_start),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
 prepared_by_person_id text NOT NULL,
 reviewed_by_person_id text,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,peos_school_id) REFERENCES school_finance.accounts(id,peos_school_id),
 UNIQUE(peos_school_id,account_id,period_start,period_end),
 CHECK(reviewed_by_person_id IS NULL OR reviewed_by_person_id<>prepared_by_person_id),
 CHECK(status<>'APPROVED' OR (reviewed_by_person_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE school_finance.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 actor_person_id text NOT NULL,
 action text NOT NULL,
 resource_type text NOT NULL,
 resource_id uuid NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_invoices_learner_idx ON school_finance.invoices(peos_school_id,learner_person_id);
CREATE INDEX finance_payments_account_idx ON school_finance.payments(peos_school_id,account_id,received_at);
CREATE INDEX finance_allocations_invoice_idx ON school_finance.allocations(invoice_id);
CREATE INDEX finance_reconciliations_pending_idx ON school_finance.reconciliations(peos_school_id,status);
REVOKE ALL ON ALL TABLES IN SCHEMA school_finance FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
   GRANT USAGE ON SCHEMA school_finance TO spacecase_runtime;
   GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA school_finance TO spacecase_runtime;
 END IF;
END $$;
