-- School fees and payment records, separate from SpaceCase subscription billing.
CREATE SCHEMA school_finance;
REVOKE ALL ON SCHEMA school_finance FROM PUBLIC;
CREATE TABLE school_finance.accounts(
 id uuid PRIMARY KEY,school_id uuid NOT NULL,learner_person_id uuid NOT NULL,
 learner_reference_snapshot varchar(80) NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(school_id,id),UNIQUE(school_id,learner_person_id)
);
CREATE TABLE school_finance.counters(school_id uuid PRIMARY KEY,next_invoice bigint NOT NULL CHECK(next_invoice>0));
CREATE TABLE school_finance.invoices(
 id uuid PRIMARY KEY,school_id uuid NOT NULL,account_id uuid NOT NULL,request_key uuid NOT NULL,
 reference varchar(80) NOT NULL,currency text NOT NULL DEFAULT 'ZAR' CHECK(currency='ZAR'),
 lines jsonb NOT NULL CHECK(jsonb_typeof(lines)='array' AND jsonb_array_length(lines) BETWEEN 1 AND 100),
 total_minor bigint NOT NULL CHECK(total_minor>0),due_date date NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','DISPUTED','VOID')),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 issued_by uuid,issued_at timestamptz,voided_by uuid,void_reason varchar(500) NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(school_id,account_id,id),UNIQUE(school_id,reference),UNIQUE(school_id,created_by,request_key),
 FOREIGN KEY(school_id,account_id) REFERENCES school_finance.accounts(school_id,id),
 CHECK((issued_by IS NULL)=(issued_at IS NULL)),CHECK(issued_by IS NULL OR issued_by<>created_by),
 CHECK(status NOT IN ('ISSUED','DISPUTED') OR issued_at IS NOT NULL),
 CHECK(status<>'DRAFT' OR issued_at IS NULL),CHECK(status<>'VOID' OR (voided_by IS NOT NULL AND length(btrim(void_reason))>0))
);
CREATE INDEX school_finance_invoice_account ON school_finance.invoices(school_id,account_id,created_at DESC,id);
CREATE TABLE school_finance.payments(
 id uuid PRIMARY KEY,school_id uuid NOT NULL,account_id uuid NOT NULL,request_key uuid NOT NULL,
 reference varchar(120) NOT NULL CHECK(length(btrim(reference))>=2),currency text NOT NULL DEFAULT 'ZAR' CHECK(currency='ZAR'),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),received_on date NOT NULL,method text NOT NULL CHECK(method IN ('EFT','CASH','OTHER')),
 status text NOT NULL DEFAULT 'REPORTED' CHECK(status IN ('REPORTED','VERIFIED','REJECTED')),
 recorded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reviewed_by uuid,reviewed_at timestamptz,review_reason varchar(500) NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(school_id,account_id,id),UNIQUE(school_id,recorded_by,request_key),FOREIGN KEY(school_id,account_id) REFERENCES school_finance.accounts(school_id,id),
 CHECK((status='REPORTED' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status<>'REPORTED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
 CHECK(status<>'VERIFIED' OR reviewed_by<>recorded_by)
);
CREATE UNIQUE INDEX school_finance_payment_reference ON school_finance.payments(school_id,lower(reference)) WHERE status<>'REJECTED';
CREATE INDEX school_finance_payment_account ON school_finance.payments(school_id,account_id,created_at DESC,id);
CREATE TABLE school_finance.allocations(
 id uuid PRIMARY KEY,school_id uuid NOT NULL,account_id uuid NOT NULL,payment_id uuid NOT NULL,invoice_id uuid NOT NULL,
 request_key uuid NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(school_id,created_by,request_key),
 FOREIGN KEY(school_id,account_id,payment_id) REFERENCES school_finance.payments(school_id,account_id,id),
 FOREIGN KEY(school_id,account_id,invoice_id) REFERENCES school_finance.invoices(school_id,account_id,id)
);
CREATE INDEX school_finance_allocation_payment ON school_finance.allocations(school_id,payment_id);
CREATE INDEX school_finance_allocation_invoice ON school_finance.allocations(school_id,invoice_id);
CREATE TABLE school_finance.events(
 id uuid PRIMARY KEY,school_id uuid NOT NULL,account_id uuid,actor_person_id uuid NOT NULL,action varchar(80) NOT NULL,resource_id uuid,reason varchar(500) NOT NULL DEFAULT '',occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(school_id,account_id) REFERENCES school_finance.accounts(school_id,id)
);
CREATE INDEX school_finance_events_account ON school_finance.events(school_id,account_id,occurred_at DESC);
ALTER TABLE school_finance.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_finance.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_finance.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_finance.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_finance.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_finance.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_scope ON school_finance.accounts USING(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid) WITH CHECK(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid);
CREATE POLICY finance_scope ON school_finance.counters USING(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid) WITH CHECK(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid);
CREATE POLICY finance_scope ON school_finance.invoices USING(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid) WITH CHECK(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid);
CREATE POLICY finance_scope ON school_finance.payments USING(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid) WITH CHECK(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid);
CREATE POLICY finance_scope ON school_finance.allocations USING(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid) WITH CHECK(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid);
CREATE POLICY finance_scope ON school_finance.events USING(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid) WITH CHECK(school_id=NULLIF(current_setting('spacecase.finance_school',true),'')::uuid);
REVOKE ALL ON ALL TABLES IN SCHEMA school_finance FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT USAGE ON SCHEMA school_finance,school_ops TO spacecase_runtime\003B
 GRANT SELECT(peos_school_id,status,timezone) ON school_ops.school_workspaces TO spacecase_runtime\003B
 GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA school_finance TO spacecase_runtime\003B
 GRANT UPDATE(next_invoice) ON school_finance.counters TO spacecase_runtime\003B
 GRANT UPDATE(status,issued_by,issued_at,voided_by,void_reason,revision) ON school_finance.invoices TO spacecase_runtime\003B
 GRANT UPDATE(status,reviewed_by,reviewed_at,review_reason,revision) ON school_finance.payments TO spacecase_runtime\003B
 END IF\003B END\003B';
