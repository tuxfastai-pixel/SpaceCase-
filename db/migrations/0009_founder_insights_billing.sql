CREATE SCHEMA IF NOT EXISTS billing;
REVOKE ALL ON SCHEMA billing FROM PUBLIC;
CREATE TABLE billing.invoices (
 id uuid PRIMARY KEY, school_id text NOT NULL,
 reference text NOT NULL UNIQUE CHECK(char_length(reference) BETWEEN 3 AND 80),
 amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000000),
 currency text NOT NULL DEFAULT 'ZAR' CHECK(currency='ZAR'),
 due_date date NOT NULL, voided boolean NOT NULL DEFAULT false,
 disputed boolean NOT NULL DEFAULT false,
 recorded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX billing_invoice_school_time_idx ON billing.invoices(school_id,created_at DESC,id);
CREATE INDEX billing_invoice_due_idx ON billing.invoices(due_date) WHERE NOT voided;
CREATE TABLE billing.receipts (
 id uuid PRIMARY KEY, invoice_id uuid NOT NULL REFERENCES billing.invoices(id),
 amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000000),
 reference text NOT NULL UNIQUE CHECK(char_length(reference) BETWEEN 3 AND 80),
 paid_on date NOT NULL, verified_by text NOT NULL,
 reversed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX billing_receipt_invoice_idx ON billing.receipts(invoice_id);
REVOKE ALL ON billing.invoices,billing.receipts FROM PUBLIC;
CREATE INDEX IF NOT EXISTS support_created_area_idx ON support.tickets(created_at,area,category);
CREATE INDEX IF NOT EXISTS support_first_technical_idx ON support.events(ticket_id,created_at) WHERE kind='TECHNICAL_UPDATE';
CREATE INDEX IF NOT EXISTS attendance_updated_school_idx ON learning.attendance_registers(updated_at,peos_school_id);
 GRANT USAGE ON SCHEMA billing TO spacecase_runtime;
 GRANT SELECT,INSERT ON billing.invoices,billing.receipts TO spacecase_runtime;
 GRANT UPDATE(voided,disputed) ON billing.invoices TO spacecase_runtime;
 GRANT UPDATE(reversed) ON billing.receipts TO spacecase_runtime;
