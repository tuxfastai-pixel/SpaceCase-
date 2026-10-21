CREATE TABLE IF NOT EXISTS learning.attendance_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
  peos_class_id text NOT NULL REFERENCES school_ops.class_workspaces(peos_class_id),
  attendance_date date NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(peos_class_id,attendance_date)
);
CREATE TABLE IF NOT EXISTS learning.attendance_entries (
  register_id uuid NOT NULL REFERENCES learning.attendance_registers(id),
  learner_person_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('UNMARKED','PRESENT','ABSENT','LATE','EXCUSED')),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(register_id,learner_person_id)
);
CREATE INDEX IF NOT EXISTS attendance_registers_school_date_idx ON learning.attendance_registers(peos_school_id,attendance_date);
REVOKE ALL ON learning.attendance_registers,learning.attendance_entries FROM PUBLIC;
-- Production uses this restricted role; CI migration owners need no extra grant.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON learning.attendance_registers,learning.attendance_entries TO spacecase_runtime;
  END IF;
END $$;
