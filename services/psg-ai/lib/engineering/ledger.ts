import {createHash} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {prepareRunnerPlan,runnerRequestSchema,type PreflightContext} from '../../../../packages/engineering-control/runner-policy';

const actorSchema=z.string().trim().min(1).max(200);
const submissionSchema=z.object({requestId:z.string().uuid(),request:runnerRequestSchema}).strict();
export type LedgerAuthority=PreflightContext & {personId:string};
export class LedgerError extends Error{}
const columns='id,project,source_reference AS "sourceReference",source_revision AS "sourceRevision",handoff_digest AS "handoffDigest",base_commit AS "baseCommit",state,revision,created_at AS "createdAt",cancelled_at AS "cancelledAt",brief_expires_at AS "briefExpiresAt",(handoff IS NOT NULL AND brief_expires_at>clock_timestamp()) AS "briefAvailable"';
async function transaction<T>(pool:Pool,work:(db:PoolClient)=>Promise<T>){
 const db=await pool.connect();
 try{await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5000ms'");await db.query("SET LOCAL lock_timeout='3000ms'");const value=await work(db);await db.query('COMMIT');return value;}
 catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
function founder(authority:LedgerAuthority){if(!authority.founder)throw new LedgerError('FOUNDER_REQUIRED');return actorSchema.parse(authority.personId);}

// Internal service entry point. Authority/current source are supplied by a trusted adapter,
// never deserialized from an HTTP body. Persistence does not grant execution authority.
export async function saveBlockedTask(pool:Pool,authority:LedgerAuthority,input:z.infer<typeof submissionSchema>){
 const actor=founder(authority),parsed=submissionSchema.parse(input);
 const plan=prepareRunnerPlan(parsed.request,authority);
 const handoff=parsed.request.handoff;
 const payloadHash=createHash('sha256').update(JSON.stringify(parsed.request)).digest('hex');
 return transaction(pool,async db=>{
  // Serialize retries for this actor/request pair before taking task locks.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([actor,parsed.requestId])]);
  const old=await db.query('SELECT payload_hash,task_id FROM engineering.requests WHERE actor_id=$1 AND request_id=$2',[actor,parsed.requestId]);
  if(old.rowCount){
   if(old.rows[0].payload_hash!==payloadHash)throw new LedgerError('REQUEST_REUSED');
   const task=await db.query(`SELECT ${columns} FROM engineering.tasks WHERE id=$1`,[old.rows[0].task_id]);
   return {task:task.rows[0],executionStarted:false as const};
  }
  const inserted=await db.query(`INSERT INTO engineering.tasks(project,repository,source_reference,source_revision,handoff_digest,base_commit,handoff,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT(project,source_reference,source_revision,handoff_digest,base_commit) DO NOTHING RETURNING ${columns}`,
   [handoff.project,plan.repository,handoff.source.reference,handoff.source.revision,plan.handoffDigest,plan.baseCommit,JSON.stringify(handoff),actor]);
  const task=inserted.rows[0]??(await db.query(`SELECT ${columns} FROM engineering.tasks WHERE project=$1 AND source_reference=$2 AND source_revision=$3 AND handoff_digest=$4 AND base_commit=$5`,[handoff.project,handoff.source.reference,handoff.source.revision,plan.handoffDigest,plan.baseCommit])).rows[0];
  if(inserted.rowCount)await db.query("INSERT INTO engineering.events(task_id,actor_id,kind,revision) VALUES($1,$2,'CREATED',0)",[task.id,actor]);
  await db.query('INSERT INTO engineering.requests(actor_id,request_id,payload_hash,task_id) VALUES($1,$2,$3,$4)',[actor,parsed.requestId,payloadHash,task.id]);
  return {task,executionStarted:false as const};
 });
}

export async function cancelBlockedTask(pool:Pool,authority:LedgerAuthority,input:{taskId:string;revision:number},options?:{sourceReference:string;idempotent:true}){
 const actor=founder(authority),parsed=z.object({taskId:z.string().uuid(),revision:z.number().int().nonnegative()}).strict().parse(input);
 const scope=options?z.string().regex(/^SC-[A-F0-9]{12}$/).parse(options.sourceReference):null;
 return transaction(pool,async db=>{
  const selected=await db.query(`SELECT ${columns} FROM engineering.tasks WHERE id=$1 AND ($2::text IS NULL OR source_reference=$2) FOR UPDATE`,[parsed.taskId,scope]);
  const task=selected.rows[0];if(!task)throw new LedgerError('TASK_UNAVAILABLE');
  if(options?.idempotent&&task.state==='CANCELLED'&&task.revision===parsed.revision+1)return {task,executionStarted:false as const};
  if(task.revision!==parsed.revision)throw new LedgerError('TASK_CHANGED');
  if(task.state!=='BLOCKED')throw new LedgerError('TASK_NOT_BLOCKED');
  const result=await db.query(`UPDATE engineering.tasks SET state='CANCELLED',revision=revision+1,cancelled_at=clock_timestamp() WHERE id=$1 RETURNING ${columns}`,[task.id]);
  await db.query("INSERT INTO engineering.events(task_id,actor_id,kind,revision) VALUES($1,$2,'CANCELLED',$3)",[task.id,actor,result.rows[0].revision]);
  return {task:result.rows[0],executionStarted:false as const};
 });
}

export async function listSourceTasks(pool:Pool,authority:LedgerAuthority,input:{sourceReference:string;offset:number}){
 founder(authority);const parsed=z.object({sourceReference:z.string().regex(/^SC-[A-F0-9]{12}$/),offset:z.number().int().min(0).max(10000)}).strict().parse(input);
 const result=await pool.query(`SELECT ${columns} FROM engineering.tasks WHERE project='SPACECASE' AND source_reference=$1 ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET $2`,[parsed.sourceReference,parsed.offset]);
 return {tasks:result.rows.slice(0,25),nextOffset:result.rows.length>25&&parsed.offset+25<=10000?parsed.offset+25:null,executionStarted:false as const};
}
