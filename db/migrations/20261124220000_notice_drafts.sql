-- Private, versioned author drafts. Publication remains an explicit separate action.
CREATE TABLE school_board.drafts (
 id uuid PRIMARY KEY,school_id uuid NOT NULL,author_person_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE school_board.draft_versions (
 draft_id uuid NOT NULL REFERENCES school_board.drafts(id),revision integer NOT NULL CHECK(revision>0),
 request_id uuid NOT NULL,digest text NOT NULL,details jsonb NOT NULL,saved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(draft_id,revision),UNIQUE(draft_id,request_id)
);
CREATE TABLE school_board.draft_events (
 id uuid PRIMARY KEY,draft_id uuid NOT NULL UNIQUE REFERENCES school_board.drafts(id),revision integer NOT NULL,
 actor_person_id uuid NOT NULL,request_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('PUBLISHED','DISCARDED')),
 notice_id uuid REFERENCES school_board.notices(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(draft_id,revision) REFERENCES school_board.draft_versions(draft_id,revision),
 CHECK((action='PUBLISHED')=(notice_id IS NOT NULL))
);
CREATE INDEX board_drafts_author ON school_board.drafts(school_id,author_person_id,created_at DESC);
REVOKE ALL ON school_board.drafts,school_board.draft_versions,school_board.draft_events FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
 GRANT SELECT,INSERT ON school_board.drafts,school_board.draft_versions,school_board.draft_events TO spacecase_runtime;
END IF; END $$;
