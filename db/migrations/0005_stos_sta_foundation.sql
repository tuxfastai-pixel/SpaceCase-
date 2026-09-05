CREATE SCHEMA IF NOT EXISTS assistant;

CREATE TABLE IF NOT EXISTS assistant.teacher_requests (
  request_id uuid PRIMARY KEY,
  teacher_person_id uuid NOT NULL,
  school_id uuid NOT NULL,
  capability text NOT NULL CHECK (capability IN ('TEACHING','ASSESSMENT','PLANNING','COMMUNICATION','ADMIN','WELLBEING','ATLAS','RESEARCH','INNOVATION')),
  intent text NOT NULL,
  status text NOT NULL CHECK (status IN ('RECEIVED','ROUTED','COMPLETED','DENIED','FAILED')),
  policy_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS teacher_requests_actor_idx ON assistant.teacher_requests (teacher_person_id, school_id, created_at DESC);
