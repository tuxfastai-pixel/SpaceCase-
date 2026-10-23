CREATE TABLE engineering.evidence_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES engineering.tasks(id),
 source_reference text NOT NULL CHECK(source_reference ~ '^SC-[A-F0-9]{12}$'),
 actor_id text NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 200),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 submitted_revision integer NOT NULL CHECK(submitted_revision>=0),
 recorded_revision integer NOT NULL CHECK(recorded_revision=submitted_revision+1),
 packet_digest text NOT NULL CHECK(packet_digest ~ '^[a-f0-9]{64}$'),
 head_commit text NOT NULL CHECK(head_commit ~ '^[a-f0-9]{40}$'),
 packet jsonb,
 recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT statement_timestamp()+interval '7 days',
 removed_at timestamptz,
 CHECK((packet IS NULL)=(removed_at IS NOT NULL)),
 CHECK(expires_at>recorded_at AND expires_at<=recorded_at+interval '7 days'),
 CHECK(packet IS NULL OR octet_length(packet::text)<=24000),
 UNIQUE(actor_id,request_id), UNIQUE(task_id,recorded_revision)
);
CREATE INDEX evidence_task_history ON engineering.evidence_records(task_id,recorded_revision DESC);
CREATE INDEX evidence_retention_due ON engineering.evidence_records(expires_at) WHERE packet IS NOT NULL;
REVOKE ALL ON engineering.evidence_records FROM PUBLIC;
GRANT SELECT,INSERT ON engineering.evidence_records TO psg_engineering_runtime;

CREATE FUNCTION engineering.expire_evidence(batch_size integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE removed integer;
BEGIN
 IF batch_size<1 OR batch_size>500 OR batch_size IS NULL THEN RAISE EXCEPTION 'INVALID_BATCH_SIZE'; END IF;
 WITH due AS (SELECT id FROM engineering.evidence_records WHERE packet IS NOT NULL AND expires_at<=clock_timestamp() ORDER BY expires_at,id LIMIT batch_size FOR UPDATE SKIP LOCKED)
 UPDATE engineering.evidence_records e SET packet=NULL,removed_at=clock_timestamp() FROM due WHERE e.id=due.id;
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END
$$;
REVOKE ALL ON FUNCTION engineering.expire_evidence(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION engineering.expire_evidence(integer) TO psg_engineering_runtime;
