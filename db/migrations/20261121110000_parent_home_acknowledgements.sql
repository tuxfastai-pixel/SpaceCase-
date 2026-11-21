-- Product UI acknowledgement only: no relationship, consent, role or payment authority.
CREATE TABLE family_intake.home_acknowledgements (
 owner_person_id text NOT NULL,
 notice_key text NOT NULL CHECK (notice_key ~ '^[a-f0-9]{64}$'),
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_person_id,notice_key)
);
REVOKE ALL ON family_intake.home_acknowledgements FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT USAGE ON SCHEMA family_intake TO spacecase_runtime;
  GRANT SELECT,INSERT ON family_intake.home_acknowledgements TO spacecase_runtime;
 END IF;
END $$;
