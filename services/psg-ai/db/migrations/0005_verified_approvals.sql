-- Keep the original non-approval constraint intact. Verified approvals have their own proof-bound store.
ALTER TABLE engineering.evidence_records ADD CONSTRAINT evidence_approval_binding UNIQUE(id,task_id,recorded_revision,packet_digest,head_commit);
CREATE TABLE engineering.verified_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES engineering.tasks(id),
 actor_id text NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 200),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 reviewed_revision integer NOT NULL CHECK(reviewed_revision>=0),
 recorded_revision integer NOT NULL CHECK(recorded_revision=reviewed_revision+1),
 decision text NOT NULL DEFAULT 'APPROVED' CHECK(decision='APPROVED'),
 review_digest text NOT NULL CHECK(review_digest ~ '^[a-f0-9]{64}$'),
 head_commit text NOT NULL CHECK(head_commit ~ '^[a-f0-9]{40}$'),
 evidence_id uuid NOT NULL,
 packet_digest text NOT NULL CHECK(packet_digest ~ '^[a-f0-9]{64}$'),
 proof jsonb NOT NULL CHECK(COALESCE(proof @> '{"evidenceVerified":true}'::jsonb AND proof->>'evidenceId'=evidence_id::text AND proof->>'packetDigest'=packet_digest AND proof->>'headCommit'=head_commit AND jsonb_typeof(proof->'blockers')='array' AND jsonb_array_length(proof->'blockers')=0 AND jsonb_typeof(proof->'reviewId')='number' AND jsonb_typeof(proof->'reviewerGithubId')='number' AND jsonb_typeof(proof->'runIds')='array' AND jsonb_array_length(proof->'runIds')>0 AND jsonb_typeof(proof->'artifactDigests')='array' AND jsonb_array_length(proof->'artifactDigests')>0 AND octet_length(proof::text)<=12000,false)),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_id,request_id), UNIQUE(task_id,recorded_revision),
 FOREIGN KEY(task_id,recorded_revision) REFERENCES engineering.review_events(task_id,revision),
 FOREIGN KEY(evidence_id,task_id,reviewed_revision,packet_digest,head_commit) REFERENCES engineering.evidence_records(id,task_id,recorded_revision,packet_digest,head_commit)
);
CREATE INDEX verified_approvals_task ON engineering.verified_approvals(task_id,recorded_revision DESC);
REVOKE ALL ON engineering.verified_approvals FROM PUBLIC;
GRANT SELECT,INSERT ON engineering.verified_approvals TO psg_engineering_runtime;
