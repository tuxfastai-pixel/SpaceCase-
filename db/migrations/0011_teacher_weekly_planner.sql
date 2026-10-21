CREATE TABLE learning.weekly_lesson_plans (
 teacher_person_id text NOT NULL,
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 peos_class_id text NOT NULL REFERENCES school_ops.class_workspaces(peos_class_id),
 week_start date NOT NULL CHECK(extract(isodow FROM week_start)=1),
 lessons jsonb NOT NULL CHECK(jsonb_typeof(lessons)='array' AND jsonb_array_length(lessons)<=50),
 revision integer NOT NULL CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(teacher_person_id,peos_class_id,week_start)
);
REVOKE ALL ON learning.weekly_lesson_plans FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT SELECT,INSERT,UPDATE ON learning.weekly_lesson_plans TO spacecase_runtime\003B
 END IF\003B END\003B';
