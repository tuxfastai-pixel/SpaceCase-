-- Unverified self-authored intake only. No canonical identities or guardian grants.
CREATE SCHEMA IF NOT EXISTS family_intake;
CREATE TABLE family_intake.drafts(
 owner_person_id text PRIMARY KEY,
 profile jsonb CHECK(jsonb_typeof(profile)='object' AND octet_length(profile::text)<=40000),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SCHEMA family_intake FROM PUBLIC;
REVOKE ALL ON family_intake.drafts FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT USAGE ON SCHEMA family_intake TO spacecase_runtime\003B
 GRANT SELECT,INSERT ON family_intake.drafts TO spacecase_runtime\003B
 GRANT UPDATE(profile,revision,updated_at) ON family_intake.drafts TO spacecase_runtime\003B
 END IF\003B END\003B';
CREATE TABLE family_intake.draft_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_person_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 action text NOT NULL CHECK(action IN ('SAVE','CLEAR')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON family_intake.draft_events FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT INSERT ON family_intake.draft_events TO spacecase_runtime\003B
 END IF\003B END\003B';

CREATE UNIQUE INDEX family_draft_event_revision_idx ON family_intake.draft_events(owner_person_id,revision);
