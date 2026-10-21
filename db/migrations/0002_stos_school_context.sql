CREATE SCHEMA IF NOT EXISTS school_ops;

CREATE TABLE IF NOT EXISTS school_ops.school_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peos_school_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  timezone text,
  academic_year_label text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_ops.class_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peos_school_id text NOT NULL,
  peos_class_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ENDED')),
  local_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_workspace_school_fk
    FOREIGN KEY (peos_school_id)
    REFERENCES school_ops.school_workspaces(peos_school_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS class_workspaces_school_idx
  ON school_ops.class_workspaces(peos_school_id, status);
