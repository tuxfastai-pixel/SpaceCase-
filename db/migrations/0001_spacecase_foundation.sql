CREATE SCHEMA IF NOT EXISTS learning;
CREATE SCHEMA IF NOT EXISTS communication;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.product_audit_events (
  id uuid PRIMARY KEY,
  actor_person_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  school_id text,
  learner_person_id text,
  decision text CHECK (decision IN ('ALLOW', 'DENY')),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_audit_events_actor_time
  ON audit.product_audit_events (actor_person_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_audit_events_learner_time
  ON audit.product_audit_events (learner_person_id, occurred_at DESC)
  WHERE learner_person_id IS NOT NULL;
