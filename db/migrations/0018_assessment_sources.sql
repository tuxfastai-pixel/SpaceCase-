-- Teacher-owned assessment source attachments; never learner submissions.
CREATE TABLE assessment.source_materials (
 id uuid PRIMARY KEY,
 assessment_id uuid NOT NULL REFERENCES assessment.assessments(id),
 kind text NOT NULL CHECK(kind IN ('QUESTION_PAPER','MEMORANDUM','SUPPORTING')),
 format text NOT NULL CHECK(format IN ('JPEG','PDF','DOCX','DOC')),
 object_key text NOT NULL UNIQUE,
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 3145728),
 upload_complete boolean NOT NULL DEFAULT false,
 transcript text NOT NULL DEFAULT '' CHECK(length(transcript)<=40000),
 transcript_reviewed boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 removed_at timestamptz,
 UNIQUE(assessment_id,content_hash,kind)
);
CREATE INDEX assessment_sources_parent ON assessment.source_materials(assessment_id,created_at,id);
REVOKE ALL ON assessment.source_materials FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT SELECT,INSERT,UPDATE ON assessment.source_materials TO spacecase_runtime\003B
 END IF\003B END\003B';

-- Replace completeness validation atomically: only drafts may lack questions.
ALTER TABLE assessment.assessments ADD CONSTRAINT assessment_rubric_stage_check
 CHECK(jsonb_typeof(rubric)='array' AND jsonb_array_length(rubric) BETWEEN 0 AND 50 AND (status='DRAFT' OR jsonb_array_length(rubric)>=1));
ALTER TABLE assessment.assessments DROP CONSTRAINT assessments_rubric_check;
