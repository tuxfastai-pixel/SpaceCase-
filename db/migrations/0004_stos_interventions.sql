CREATE TABLE IF NOT EXISTS learning.interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peos_school_id text NOT NULL,
  peos_learner_person_id text NOT NULL,
  peos_class_id text NOT NULL,
  intervention_type text NOT NULL CHECK (
    intervention_type IN (
      'INSTRUCTIONAL_SUPPORT',
      'HOMEWORK_SUPPORT',
      'ATTENDANCE_SUPPORT',
      'BEHAVIOUR_SUPPORT',
      'COMMUNICATION_SUPPORT'
    )
  ),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED')
  ),
  goal text NOT NULL CHECK (char_length(goal) BETWEEN 1 AND 500),
  created_by_person_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT intervention_profile_fk
    FOREIGN KEY (peos_school_id, peos_learner_person_id)
    REFERENCES learning.learner_profiles(peos_school_id, peos_learner_person_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS interventions_learner_status_idx
  ON learning.interventions(peos_school_id, peos_learner_person_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS interventions_class_status_idx
  ON learning.interventions(peos_school_id, peos_class_id, status, created_at DESC);
