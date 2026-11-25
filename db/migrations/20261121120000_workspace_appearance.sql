-- Product presentation only; no identity verification, relationship or billing authority.
CREATE SCHEMA IF NOT EXISTS presentation;
CREATE TABLE presentation.school_logos(
 school_id uuid PRIMARY KEY,jpeg bytea NOT NULL CHECK(octet_length(jpeg) BETWEEN 1 AND 204800),
 updated_by text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE family_intake.account_photos(
 owner_person_id text NOT NULL,school_id uuid NOT NULL,learner_person_id uuid NOT NULL,child_id uuid NOT NULL,
 PRIMARY KEY(owner_person_id,school_id,learner_person_id),
 FOREIGN KEY(owner_person_id,child_id) REFERENCES family_intake.child_photos(owner_person_id,child_id) ON DELETE CASCADE
);
REVOKE ALL ON SCHEMA presentation FROM PUBLIC;
REVOKE ALL ON presentation.school_logos,family_intake.account_photos FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
 GRANT USAGE ON SCHEMA presentation TO spacecase_runtime;
 GRANT SELECT,INSERT,UPDATE,DELETE ON presentation.school_logos,family_intake.account_photos TO spacecase_runtime;
 END IF;
END $$;
