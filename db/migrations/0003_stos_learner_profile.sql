CREATE TABLE IF NOT EXISTS learning.learner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peos_school_id text NOT NULL,
  peos_learner_person_id text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_by_person_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(peos_school_id, peos_learner_person_id)
);

CREATE INDEX IF NOT EXISTS learner_profiles_school_idx
  ON learning.learner_profiles(peos_school_id, status);
