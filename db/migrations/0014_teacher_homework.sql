CREATE TABLE learning.homework_tasks(
 id uuid PRIMARY KEY,
 teacher_person_id text NOT NULL,
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 peos_class_id text NOT NULL REFERENCES school_ops.class_workspaces(peos_class_id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 80),
 instructions text NOT NULL CHECK(length(instructions) BETWEEN 1 AND 8000),
 assigned_date date NOT NULL,
 due_date date NOT NULL CHECK(due_date>=assigned_date),
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ASSIGNED','CLOSED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 completions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(completions)='object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX homework_teacher_class_idx ON learning.homework_tasks(teacher_person_id,peos_school_id,peos_class_id,created_at DESC,id DESC);
CREATE TABLE learning.homework_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES learning.homework_tasks(id),
 actor_person_id text NOT NULL,
 revision integer NOT NULL,
 action text NOT NULL,
 metadata jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(task_id,revision)
);
REVOKE ALL ON learning.homework_tasks,learning.homework_events FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT SELECT,INSERT,UPDATE ON learning.homework_tasks TO spacecase_runtime\003B
 GRANT SELECT,INSERT ON learning.homework_events TO spacecase_runtime\003B
 END IF\003B END\003B';
