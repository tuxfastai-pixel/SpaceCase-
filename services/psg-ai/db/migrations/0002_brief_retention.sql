ALTER TABLE engineering.tasks ALTER COLUMN handoff DROP NOT NULL;
ALTER TABLE engineering.tasks ADD COLUMN brief_expires_at timestamptz;
UPDATE engineering.tasks SET brief_expires_at=created_at+interval '7 days';
ALTER TABLE engineering.tasks ALTER COLUMN brief_expires_at SET NOT NULL;
ALTER TABLE engineering.tasks ALTER COLUMN brief_expires_at SET DEFAULT (clock_timestamp()+interval '7 days');
ALTER TABLE engineering.tasks ADD COLUMN brief_removed_at timestamptz;
ALTER TABLE engineering.tasks ADD CONSTRAINT brief_removal_consistent CHECK((handoff IS NULL)=(brief_removed_at IS NOT NULL));
ALTER TABLE engineering.events DROP CONSTRAINT events_kind_check;
ALTER TABLE engineering.events ADD CONSTRAINT events_kind_check CHECK(kind IN('CREATED','CANCELLED','BRIEF_EXPIRED'));
CREATE INDEX tasks_expiring_brief ON engineering.tasks(brief_expires_at,id) WHERE handoff IS NOT NULL;
CREATE FUNCTION engineering.expire_briefs(batch_size integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE changed integer;
BEGIN
 WITH due AS (
  SELECT id FROM engineering.tasks WHERE handoff IS NOT NULL AND brief_expires_at<=clock_timestamp()
  ORDER BY brief_expires_at,id LIMIT greatest(1,least(coalesce(batch_size,100),500)) FOR UPDATE SKIP LOCKED
 ), expired AS (
  UPDATE engineering.tasks t SET handoff=NULL,brief_removed_at=clock_timestamp(),revision=revision+1
  FROM due WHERE t.id=due.id RETURNING t.id,t.revision
 ), recorded AS (
  INSERT INTO engineering.events(task_id,actor_id,kind,revision)
  SELECT id,'system:retention','BRIEF_EXPIRED',revision FROM expired RETURNING id
 ) SELECT count(*) INTO changed FROM recorded;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION engineering.expire_briefs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION engineering.expire_briefs(integer) TO psg_engineering_runtime;
