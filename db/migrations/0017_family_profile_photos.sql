-- Small owner-only intake avatars; never canonical identity or public media.
CREATE TABLE family_intake.child_photos (
 owner_person_id text NOT NULL REFERENCES family_intake.drafts(owner_person_id),
 child_id uuid NOT NULL,
 jpeg bytea NOT NULL CHECK(octet_length(jpeg) BETWEEN 1 AND 102400),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_person_id,child_id)
);
REVOKE ALL ON family_intake.child_photos FROM PUBLIC;
DO U&'BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=''spacecase_runtime'') THEN
 GRANT SELECT,INSERT,UPDATE,DELETE ON family_intake.child_photos TO spacecase_runtime\003B
 END IF\003B END\003B';
CREATE FUNCTION family_intake.prune_child_photos() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM family_intake.child_photos p WHERE p.owner_person_id=NEW.owner_person_id
 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.profile->'children','[]'::jsonb)) child WHERE child->>'id'=p.child_id::text);
 RETURN NEW;
END;
$$;
CREATE TRIGGER prune_family_photos AFTER UPDATE OF profile ON family_intake.drafts
 FOR EACH ROW EXECUTE FUNCTION family_intake.prune_child_photos();
