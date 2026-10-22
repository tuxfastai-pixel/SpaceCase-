CREATE TABLE learning.classroom_observations(
 id uuid PRIMARY KEY,
 teacher_person_id text NOT NULL,
 peos_school_id text NOT NULL REFERENCES school_ops.school_workspaces(peos_school_id),
 peos_class_id text NOT NULL REFERENCES school_ops.class_workspaces(peos_class_id),
 learner_person_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('POSITIVE','LEARNING_SUPPORT','BEHAVIOUR_SUPPORT')),
 observed_date date NOT NULL,
 context text NOT NULL CHECK(length(context) BETWEEN 1 AND 160),
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 1 AND 3000),
 response text NOT NULL DEFAULT '' CHECK(length(response)<=2000),
 next_step text NOT NULL DEFAULT '' CHECK(length(next_step)<=2000),
 follow_up_date date CHECK(follow_up_date>=observed_date),
 state text NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','RESOLVED','RETRACTED')),
 outcome text NOT NULL DEFAULT '' CHECK(length(outcome)<=2000),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(state<>'RESOLVED' OR length(outcome)>0)
);
CREATE INDEX observations_teacher_class_idx ON learning.classroom_observations(teacher_person_id,peos_school_id,peos_class_id,created_at DESC,id DESC);
CREATE INDEX observations_teacher_learner_idx ON learning.classroom_observations(teacher_person_id,peos_class_id,learner_person_id);
CREATE TABLE learning.observation_revisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 observation_id uuid NOT NULL REFERENCES learning.classroom_observations(id),
 actor_person_id text NOT NULL,
 revision integer NOT NULL,
 action text NOT NULL,
 reason text,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(observation_id,revision)
);
REVOKE ALL ON learning.classroom_observations,learning.observation_revisions FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT SELECT,INSERT ON learning.classroom_observations,learning.observation_revisions TO spacecase_runtime\003B
 GRANT UPDATE(kind,observed_date,context,evidence,response,next_step,follow_up_date,state,outcome,revision,updated_at) ON learning.classroom_observations TO spacecase_runtime\003B
 END IF\003B END\003B';
