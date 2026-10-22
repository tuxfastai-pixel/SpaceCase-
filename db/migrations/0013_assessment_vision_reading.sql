ALTER TABLE assessment.pages ADD COLUMN quality jsonb;
ALTER TABLE assessment.submissions ADD COLUMN reading jsonb,ADD COLUMN reading_review jsonb;
ALTER TABLE assessment.ai_runs ADD COLUMN purpose text NOT NULL DEFAULT 'MARK' CHECK(purpose IN ('READ','MARK')),
 ADD COLUMN execution_claimed_at timestamptz;
CREATE INDEX assessment_claimed_time_idx ON assessment.ai_runs(execution_claimed_at) WHERE execution_claimed_at IS NOT NULL;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT UPDATE(reading,reading_review) ON assessment.submissions TO spacecase_runtime\003B
 GRANT UPDATE(execution_claimed_at) ON assessment.ai_runs TO spacecase_runtime\003B
 END IF\003B END\003B';
