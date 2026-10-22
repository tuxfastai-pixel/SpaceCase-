CREATE SCHEMA IF NOT EXISTS assessment;
CREATE TABLE assessment.assessments (
 id uuid PRIMARY KEY,
 teacher_person_id text NOT NULL,
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 peos_class_id text NOT NULL REFERENCES school_ops.class_workspaces(peos_class_id),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 160),
 subject text NOT NULL CHECK(char_length(subject) BETWEEN 1 AND 80),
 instructions text NOT NULL CHECK(char_length(instructions)<=4000),
 rubric jsonb NOT NULL CHECK(jsonb_array_length(rubric) BETWEEN 1 AND 50),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','OPEN')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assessment_owner_class_idx ON assessment.assessments(teacher_person_id,peos_school_id,peos_class_id,created_at DESC,id);
CREATE TABLE assessment.submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assessment_id uuid NOT NULL REFERENCES assessment.assessments(id),
 learner_person_id text NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 matching_confirmed boolean NOT NULL DEFAULT false,
 proposal jsonb,review_scores jsonb,
 current_result_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assessment_id,learner_person_id)
);
CREATE TABLE assessment.pages (
 id uuid PRIMARY KEY,assessment_id uuid NOT NULL REFERENCES assessment.assessments(id),
 submission_id uuid REFERENCES assessment.submissions(id),page_number integer CHECK(page_number BETWEEN 1 AND 10),
 object_key text NOT NULL UNIQUE,content_hash text NOT NULL,byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 2097152),
 created_at timestamptz NOT NULL DEFAULT now(),removed_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),upload_complete boolean NOT NULL DEFAULT false,
 CHECK((submission_id IS NULL)=(page_number IS NULL))
);
CREATE UNIQUE INDEX assessment_page_order_idx ON assessment.pages(submission_id,page_number) WHERE removed_at IS NULL;
CREATE INDEX assessment_pages_assessment_idx ON assessment.pages(assessment_id,created_at,id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX assessment_pages_duplicate_idx ON assessment.pages(assessment_id,content_hash) WHERE removed_at IS NULL;
CREATE TABLE assessment.results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),submission_id uuid NOT NULL REFERENCES assessment.submissions(id),
 teacher_person_id text NOT NULL,source_revision integer NOT NULL,scores jsonb NOT NULL,
 total numeric(7,1) NOT NULL CHECK(total>=0),maximum integer NOT NULL CHECK(maximum BETWEEN 1 AND 1000),
 approved_at timestamptz NOT NULL DEFAULT now(),UNIQUE(submission_id,source_revision)
);
CREATE TABLE assessment.result_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),submission_id uuid NOT NULL REFERENCES assessment.submissions(id),
 result_id uuid NOT NULL REFERENCES assessment.results(id),actor_person_id text NOT NULL,
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 10 AND 1000),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assessment.submissions ADD CONSTRAINT assessment_current_result_fk FOREIGN KEY(current_result_id) REFERENCES assessment.results(id);
CREATE TABLE assessment.ai_runs (
 id uuid PRIMARY KEY,submission_id uuid NOT NULL REFERENCES assessment.submissions(id),actor_person_id text NOT NULL,
 source_revision integer NOT NULL,input_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('RUNNING','COMPLETED','FAILED','STALE')),
 execution_id text,model_ref text,policy_version text,
 created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz
);
CREATE INDEX assessment_ai_actor_time_idx ON assessment.ai_runs(actor_person_id,created_at);
REVOKE ALL ON ALL TABLES IN SCHEMA assessment FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT USAGE ON SCHEMA assessment TO spacecase_runtime\003B
 GRANT SELECT,INSERT ON assessment.assessments,assessment.submissions,assessment.pages,assessment.results,assessment.result_events,assessment.ai_runs TO spacecase_runtime\003B
 GRANT UPDATE(status,title,subject,instructions,rubric,revision) ON assessment.assessments TO spacecase_runtime\003B
 GRANT UPDATE(revision,matching_confirmed,proposal,review_scores,current_result_id,updated_at) ON assessment.submissions TO spacecase_runtime\003B
 GRANT UPDATE(submission_id,page_number,removed_at,revision,upload_complete) ON assessment.pages TO spacecase_runtime\003B
 GRANT UPDATE(status,execution_id,model_ref,policy_version,finished_at) ON assessment.ai_runs TO spacecase_runtime\003B
 END IF\003B END\003B';
