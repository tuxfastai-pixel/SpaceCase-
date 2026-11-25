-- Teacher context reads product configuration only after canonical PEOS authorization.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='spacecase_runtime') THEN
  GRANT USAGE ON SCHEMA school_ops TO spacecase_runtime;
  GRANT SELECT ON school_ops.school_workspaces,school_ops.class_workspaces TO spacecase_runtime;
 END IF;
END $$;
