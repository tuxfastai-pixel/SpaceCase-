-- Public-facing school branding projection only; no identity/learner records.
CREATE TABLE presentation.school_login_branding (
 school_id uuid PRIMARY KEY, display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 200), updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON presentation.school_login_branding FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
 GRANT SELECT,INSERT,UPDATE,DELETE ON presentation.school_login_branding TO spacecase_runtime;
END IF; END $$;
