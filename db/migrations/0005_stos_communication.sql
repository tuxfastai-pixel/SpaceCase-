CREATE SCHEMA IF NOT EXISTS communication;

CREATE TABLE IF NOT EXISTS communication.parent_messages (
  message_id uuid PRIMARY KEY,
  school_id uuid NOT NULL,
  learner_person_id uuid,
  teacher_person_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('LEARNER_PROGRESS','HOMEWORK','ATTENDANCE','BEHAVIOUR','GENERAL_SCHOOL')),
  status text NOT NULL CHECK (status IN ('DRAFT','REVIEWED','APPROVED','SENT','CANCELLED')),
  subject text NOT NULL,
  body text NOT NULL,
  ai_assisted boolean NOT NULL DEFAULT false,
  approved_by_person_id uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status NOT IN ('APPROVED','SENT')) OR (approved_by_person_id IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK ((status <> 'SENT') OR sent_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS parent_messages_teacher_idx ON communication.parent_messages (teacher_person_id, school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS parent_messages_learner_idx ON communication.parent_messages (learner_person_id, school_id, created_at DESC);
