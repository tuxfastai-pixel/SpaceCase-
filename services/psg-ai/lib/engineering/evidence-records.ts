import {createHash} from 'node:crypto';
import {z} from 'zod';import type {Pool,PoolClient} from 'pg';
import {collectEvidencePacket} from '../../../../packages/engineering-control/evidence-packet';
import {saveEvidenceSchema,evidenceRecordSchema,evidenceListSchema} from '../../../../packages/engineering-control/evidence-record-contract';
import {founder,transaction,LedgerError,type LedgerAuthority} from './ledger';
const scope=z.object({taskId:z.string().uuid(),sourceReference:z.string().regex(/^SC-[A-F0-9]{12}$/)}).strict();
const columns='id,task_id AS "taskId",source_reference AS "sourceReference",request_id AS "requestId",submitted_revision AS "submittedRevision",recorded_revision AS "recordedRevision",packet_digest AS "packetDigest",head_commit AS "headCommit",recorded_at AS "recordedAt",expires_at AS "expiresAt"';
function record(row:object){return evidenceRecordSchema.parse(JSON.parse(JSON.stringify({...row,verification:'UNVERIFIED',executionStarted:false,releasePermission:false})));}
async function existing(db:PoolClient,actor:string,requestId:string,hash:string){
 const old=await db.query(`SELECT ${columns},payload_hash AS "payloadHash" FROM engineering.evidence_records WHERE actor_id=$1 AND request_id=$2`,[actor,requestId]);
 if(!old.rowCount)return null;const {payloadHash,...row}=old.rows[0];if(payloadHash!==hash)throw new LedgerError('REQUEST_REUSED');return record(row);
}
export async function saveEvidence(pool:Pool,authority:LedgerAuthority,input:z.infer<typeof saveEvidenceSchema>){
 const actor=founder(authority),parsed=saveEvidenceSchema.parse(input),hash=createHash('sha256').update(JSON.stringify(parsed)).digest('hex');
 return transaction(pool,async db=>{
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([actor,parsed.requestId])]);
  const old=await existing(db,actor,parsed.requestId,hash);if(old)return old;
  const selected=await db.query(`SELECT t.revision,t.source_revision,t.handoff_digest,t.base_commit,t.state,(t.handoff IS NOT NULL AND t.brief_expires_at>clock_timestamp()) AS available,l.pull_request,l.head_commit FROM engineering.tasks t LEFT JOIN LATERAL(SELECT pull_request,head_commit FROM engineering.pull_request_links WHERE task_id=t.id ORDER BY revision DESC LIMIT 1) l ON true WHERE t.id=$1 AND t.project='SPACECASE' AND t.source_reference=$2 FOR UPDATE OF t`,[parsed.taskId,parsed.sourceReference]);
  if(!selected.rowCount)throw new LedgerError('TASK_UNAVAILABLE');const task=selected.rows[0];
  if(task.revision!==parsed.revision)throw new LedgerError('TASK_CHANGED');if(task.state!=='BLOCKED')throw new LedgerError('TASK_NOT_BLOCKED');if(!authority.sourceOpen)throw new LedgerError('CASE_CLOSED');if(task.source_revision!==authority.sourceRevision)throw new LedgerError('SOURCE_CHANGED');if(!task.available)throw new LedgerError('BRIEF_EXPIRED');if(!task.head_commit)throw new LedgerError('PR_NOT_LINKED');
  const collected=collectEvidencePacket({version:'psg.engineering-evidence.v1',binding:{taskId:parsed.taskId,taskRevision:parsed.revision+1,sourceReference:parsed.sourceReference,sourceRevision:task.source_revision,handoffDigest:task.handoff_digest,repository:'tuxfastai-pixel/SpaceCase-',pullRequest:task.pull_request,baseCommit:task.base_commit,headCommit:task.head_commit},...parsed.content});
  const revision=parsed.revision+1;
  await db.query('UPDATE engineering.tasks SET revision=$2 WHERE id=$1',[parsed.taskId,revision]);
  const saved=await db.query(`INSERT INTO engineering.evidence_records(task_id,source_reference,actor_id,request_id,payload_hash,submitted_revision,recorded_revision,packet_digest,head_commit,packet) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING ${columns}`,[parsed.taskId,parsed.sourceReference,actor,parsed.requestId,hash,parsed.revision,revision,collected.packetDigest,task.head_commit,JSON.stringify(collected.packet)]);
  return record(saved.rows[0]);
 });
}
export async function listEvidence(pool:Pool,authority:LedgerAuthority,input:z.infer<typeof scope>){
 founder(authority);const parsed=scope.parse(input);
 return transaction(pool,async db=>{
  const task=await db.query("SELECT id FROM engineering.tasks WHERE id=$1 AND source_reference=$2 AND project='SPACECASE'",[parsed.taskId,parsed.sourceReference]);if(!task.rowCount)throw new LedgerError('TASK_UNAVAILABLE');
  const result=await db.query(`SELECT ${columns},CASE WHEN expires_at>clock_timestamp() THEN packet ELSE NULL END AS packet FROM engineering.evidence_records WHERE task_id=$1 AND source_reference=$2 ORDER BY recorded_revision DESC LIMIT 5`,[parsed.taskId,parsed.sourceReference]);
  return evidenceListSchema.parse({taskId:parsed.taskId,sourceReference:parsed.sourceReference,records:result.rows.map(({packet,...row})=>({...record(row),packet})),executionStarted:false});
 });
}
