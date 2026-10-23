import {verifyGithubEvidence} from '../../../../packages/engineering-control/github-evidence';
import {listEvidence} from './evidence-records';
import {createHash} from 'node:crypto';import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {linkedTaskSchema,linkedReviewSchema,recordedDecisionSchema,linkInputSchema,decisionInputSchema,type LinkedTask,type LinkedReview} from '../../../../packages/engineering-control/linked-review-contract';
import {inspectRepository} from '../../../../packages/engineering-control/repository-reader';
import {founder,transaction,LedgerError,type LedgerAuthority} from './ledger';
type ReviewDependencies={inspect:typeof inspectRepository;now:()=>Date;verify?:typeof verifyGithubEvidence};
const scopeSchema=z.object({taskId:z.string().uuid(),sourceReference:z.string().regex(/^SC-[A-F0-9]{12}$/)}).strict();
type Scope=z.infer<typeof scopeSchema>;
const json=(value:unknown)=>JSON.parse(JSON.stringify(value));
async function selectLinked(db:Pool|PoolClient,input:Scope,lock=false):Promise<LinkedTask>{
 const selected=await db.query(`SELECT t.id AS "taskId",t.source_reference AS "sourceReference",t.revision AS "taskRevision",t.source_revision AS "sourceRevision",t.state,t.base_commit AS "baseCommit",(t.handoff IS NOT NULL AND t.brief_expires_at>clock_timestamp()) AS "briefAvailable",l.pull_request AS "pullRequest",l.head_commit AS "headCommit",l.base_commit AS "linkBaseCommit",l.revision AS "linkedRevision",l.linked_at AS "linkedAt"
 FROM engineering.tasks t LEFT JOIN LATERAL (SELECT pull_request,head_commit,base_commit,revision,linked_at FROM engineering.pull_request_links WHERE task_id=t.id ORDER BY revision DESC LIMIT 1) l ON true
 WHERE t.id=$1 AND t.project='SPACECASE' AND t.source_reference=$2 ${lock?'FOR UPDATE OF t':''}`,[input.taskId,input.sourceReference]);
 if(!selected.rowCount)throw new LedgerError('TASK_UNAVAILABLE');const row=selected.rows[0];
 return linkedTaskSchema.parse(json({taskId:row.taskId,sourceReference:row.sourceReference,taskRevision:row.taskRevision,sourceRevision:row.sourceRevision,state:row.state,briefAvailable:row.briefAvailable,baseCommit:row.baseCommit,link:row.pullRequest===null?null:{pullRequest:row.pullRequest,headCommit:row.headCommit,baseCommit:row.linkBaseCommit,linkedRevision:row.linkedRevision,linkedAt:row.linkedAt},executionStarted:false}));
}
export async function readLinkedTask(pool:Pool,authority:LedgerAuthority,input:Scope){founder(authority);const scope=scopeSchema.parse(input);return transaction(pool,db=>selectLinked(db,scope));}
function linkable(task:LinkedTask,authority:LedgerAuthority,revision:number){
 if(task.taskRevision!==revision)throw new LedgerError('TASK_CHANGED');if(task.state!=='BLOCKED')throw new LedgerError('TASK_NOT_BLOCKED');
 if(!authority.sourceOpen)throw new LedgerError('CASE_CLOSED');if(task.sourceRevision!==authority.sourceRevision)throw new LedgerError('SOURCE_CHANGED');if(!task.briefAvailable)throw new LedgerError('BRIEF_EXPIRED');
}
function identicalLink(task:LinkedTask,input:z.infer<typeof linkInputSchema>){return task.taskRevision===input.revision+1&&task.link?.linkedRevision===task.taskRevision&&task.link.pullRequest===input.pullRequest&&task.link.headCommit===input.headCommit;}
export async function linkPullRequest(pool:Pool,authority:LedgerAuthority,input:z.infer<typeof linkInputSchema>,reader:typeof inspectRepository=inspectRepository){
 const actor=founder(authority),parsed=linkInputSchema.parse(input),scope={taskId:parsed.taskId,sourceReference:parsed.sourceReference};
 const before=await readLinkedTask(pool,authority,scope);if(identicalLink(before,parsed))return before;if(before.link?.pullRequest===parsed.pullRequest&&before.link.headCommit===parsed.headCommit&&before.taskRevision===parsed.revision)throw new LedgerError('LINK_UNCHANGED');linkable(before,authority,parsed.revision);
 // No database locks are held while reading GitHub.
 const snapshot=await reader({pullRequest:parsed.pullRequest,expectedHeadCommit:parsed.headCommit});
 if(snapshot.repository!=='tuxfastai-pixel/SpaceCase-'||snapshot.pullRequest!==parsed.pullRequest||snapshot.expectedHeadCommit!==parsed.headCommit||snapshot.headCommit!==parsed.headCommit||snapshot.state!=='OPEN'||snapshot.baseBranch!=='main')throw new LedgerError('LINK_REFERENCE_CHANGED');
 if(snapshot.baseCommit!==before.baseCommit)throw new LedgerError('LINK_BASE_CHANGED');
 return transaction(pool,async db=>{
  const task=await selectLinked(db,scope,true);if(identicalLink(task,parsed))return task;linkable(task,authority,parsed.revision);
  const revision=task.taskRevision+1;await db.query('UPDATE engineering.tasks SET revision=$2 WHERE id=$1',[task.taskId,revision]);
  await db.query("INSERT INTO engineering.review_events(task_id,actor_id,kind,revision) VALUES($1,$2,'PR_LINKED',$3)",[task.taskId,actor,revision]);
  await db.query('INSERT INTO engineering.pull_request_links(task_id,revision,pull_request,head_commit,base_commit) VALUES($1,$2,$3,$4,$5)',[task.taskId,revision,parsed.pullRequest,parsed.headCommit,snapshot.baseCommit]);
  return selectLinked(db,scope);
 });
}
const decisionRows='SELECT id,task_id,actor_id,request_id,payload_hash,reviewed_revision,recorded_revision,decision,review_digest,head_commit,recorded_at FROM engineering.founder_decisions UNION ALL SELECT id,task_id,actor_id,request_id,payload_hash,reviewed_revision,recorded_revision,decision,review_digest,head_commit,recorded_at FROM engineering.verified_approvals';
const decisionColumns='d.id,d.task_id AS "taskId",t.source_reference AS "sourceReference",d.request_id AS "requestId",d.reviewed_revision AS "reviewedRevision",d.recorded_revision AS "recordedRevision",d.decision,d.review_digest AS "reviewDigest",d.head_commit AS "headCommit",d.recorded_at AS "recordedAt"';
function decisionResult(row:unknown){return recordedDecisionSchema.parse(json({...row as object,executionStarted:false,releasePermission:false}));}
export async function readLinkedReview(pool:Pool,authority:LedgerAuthority,input:Scope,deps:ReviewDependencies={inspect:inspectRepository,now:()=>new Date()}):Promise<LinkedReview>{
 founder(authority);const scope=scopeSchema.parse(input),task=await readLinkedTask(pool,authority,scope);let repository=null;
 if(task.link){try{repository=await deps.inspect({pullRequest:task.link.pullRequest,expectedHeadCommit:task.link.headCommit});}catch{/* Unavailable evidence is an explicit blocker, never a success. */}}
 let verification:LinkedReview['verification']=null;
 const latest=(await listEvidence(pool,authority,scope)).records[0];
 if(latest){
  const binding=latest.packet?.binding;const matches=binding&&binding.taskId===task.taskId&&binding.sourceReference===task.sourceReference&&binding.taskRevision===task.taskRevision&&binding.sourceRevision===authority.sourceRevision&&binding.baseCommit===task.baseCommit&&binding.headCommit===task.link?.headCommit&&binding.pullRequest===task.link?.pullRequest;
  let checked={evidenceVerified:false,blockers:[latest.packet?'EVIDENCE_BINDING_CHANGED':'EVIDENCE_DETAILS_EXPIRED'],reviewId:null as number|null,reviewerGithubId:null as number|null,runIds:[] as number[],artifactDigests:[] as string[]};
  if(matches&&latest.packet&&repository&&authority.sourceOpen&&task.state==='BLOCKED'&&task.briefAvailable){try{checked=await(deps.verify??verifyGithubEvidence)(latest.packet,latest.packetDigest,repository);}catch{checked.blockers=['GITHUB_EVIDENCE_UNAVAILABLE'];}}
  verification={evidenceId:latest.id,packetDigest:latest.packetDigest,headCommit:latest.headCommit,expiresAt:latest.expiresAt,...checked};
 }
 const decisions=await transaction(pool,async db=>{
  const current=await selectLinked(db,scope,true);if(JSON.stringify(current)!==JSON.stringify(task))throw new LedgerError('TASK_CHANGED');
  if(verification?.evidenceVerified){const available=await db.query('SELECT id FROM engineering.evidence_records WHERE id=$1 AND task_id=$2 AND recorded_revision=$3 AND packet_digest=$4 AND packet IS NOT NULL AND expires_at>clock_timestamp()',[verification.evidenceId,task.taskId,task.taskRevision,verification.packetDigest]);if(!available.rowCount){verification.evidenceVerified=false;verification.blockers.push('EVIDENCE_DETAILS_EXPIRED');}}
  return db.query(`SELECT ${decisionColumns} FROM (${decisionRows}) d JOIN engineering.tasks t ON t.id=d.task_id WHERE t.id=$1 AND t.source_reference=$2 ORDER BY d.recorded_revision DESC LIMIT 5`,[scope.taskId,scope.sourceReference]);
 });
 const blockers: z.infer<typeof linkedReviewSchema>['blockers']=verification?.evidenceVerified?[]:['CODE_REVIEW_UNVERIFIED','REPRODUCTION_UNVERIFIED','ROLLBACK_UNVERIFIED'];
 if(task.state!=='BLOCKED')blockers.push('TASK_CANCELLED');if(task.sourceRevision!==authority.sourceRevision)blockers.push('SOURCE_CHANGED');if(!authority.sourceOpen)blockers.push('SOURCE_CLOSED');if(!task.briefAvailable)blockers.push('BRIEF_EXPIRED');
 if(!task.link)blockers.push('PR_NOT_LINKED');else if(!repository)blockers.push('REPOSITORY_UNAVAILABLE');else{
  if(repository.pullRequest!==task.link.pullRequest||repository.expectedHeadCommit!==task.link.headCommit||repository.headCommit!==task.link.headCommit)blockers.push('HEAD_CHANGED');
  if(repository.baseCommit!==task.baseCommit||repository.baseBranch!=='main')blockers.push('BASE_CHANGED');if(repository.validation!=='PASSED'||repository.blockers.length)blockers.push('WORKFLOW_BLOCKED');
 }
 const evidence={task,currentSource:{revision:authority.sourceRevision,open:authority.sourceOpen},repository,verification,blockers,decisions:decisions.rows.map(decisionResult),recommendation:blockers.length?'MORE_EVIDENCE_REQUIRED' as const:'READY_FOR_FOUNDER' as const,approvalAvailable:blockers.length===0,executionStarted:false as const,releasePermission:false as const};
 // Observation time alone does not invalidate an otherwise identical snapshot.
 const canonical={...evidence,repository:repository?{...repository,observedAt:undefined}:null};
 return linkedReviewSchema.parse({...evidence,reviewDigest:createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),observedAt:deps.now().toISOString()});
}
async function oldDecision(db:Pool|PoolClient,actor:string,input:z.infer<typeof decisionInputSchema>,hash:string){
 const result=await db.query(`SELECT ${decisionColumns},d.payload_hash AS "payloadHash" FROM (${decisionRows}) d JOIN engineering.tasks t ON t.id=d.task_id WHERE d.actor_id=$1 AND d.request_id=$2`,[actor,input.requestId]);
 if(!result.rowCount)return null;const {payloadHash,...row}=result.rows[0];if(payloadHash!==hash)throw new LedgerError('REQUEST_REUSED');return decisionResult(row);
}
export async function recordReviewDecision(pool:Pool,authority:LedgerAuthority,input:z.infer<typeof decisionInputSchema>,deps:ReviewDependencies={inspect:inspectRepository,now:()=>new Date()}){
 const actor=founder(authority),parsed=decisionInputSchema.parse(input);if(parsed.decision==='APPROVED'&&!parsed.evidenceId)throw new LedgerError('REVIEW_NOT_READY');
 const hash=createHash('sha256').update(JSON.stringify(parsed)).digest('hex');const old=await transaction(pool,db=>oldDecision(db,actor,parsed,hash));if(old)return old;
 let review:LinkedReview;try{review=await readLinkedReview(pool,authority,{taskId:parsed.taskId,sourceReference:parsed.sourceReference},deps);}catch(error){const retry=await transaction(pool,db=>oldDecision(db,actor,parsed,hash));if(retry)return retry;throw error;}
 if(review.reviewDigest!==parsed.reviewDigest||review.task.taskRevision!==parsed.revision){const replay=await transaction(pool,db=>oldDecision(db,actor,parsed,hash));if(replay)return replay;throw new LedgerError('REVIEW_CHANGED');}
 if(parsed.decision==='APPROVED'&&(!review.approvalAvailable||!review.verification?.evidenceVerified||parsed.evidenceId!==review.verification.evidenceId))throw new LedgerError('REVIEW_NOT_READY');
 return transaction(pool,async db=>{
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([actor,parsed.requestId])]);const retry=await oldDecision(db,actor,parsed,hash);if(retry)return retry;
  const task=await selectLinked(db,{taskId:parsed.taskId,sourceReference:parsed.sourceReference},true);if(JSON.stringify(task)!==JSON.stringify(review.task))throw new LedgerError('REVIEW_CHANGED');
  if(parsed.decision==='APPROVED'){const proof=review.verification!;const available=await db.query('SELECT engineering.lock_approval_evidence($1,$2,$3,$4) AS available',[proof.evidenceId,task.taskId,task.taskRevision,proof.packetDigest]);if(!available.rows[0].available)throw new LedgerError('REVIEW_NOT_READY');}
  const revision=task.taskRevision+1;await db.query('UPDATE engineering.tasks SET revision=$2 WHERE id=$1',[task.taskId,revision]);
  await db.query("INSERT INTO engineering.review_events(task_id,actor_id,kind,revision) VALUES($1,$2,'DECISION_RECORDED',$3)",[task.taskId,actor,revision]);
  const values=[task.taskId,actor,parsed.requestId,hash,parsed.revision,revision,parsed.decision,parsed.reviewDigest,task.link?.headCommit??null];
  const saved=parsed.decision==='APPROVED'?await db.query('INSERT INTO engineering.verified_approvals(task_id,actor_id,request_id,payload_hash,reviewed_revision,recorded_revision,decision,review_digest,head_commit,evidence_id,packet_digest,proof) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING id',[...values,review.verification!.evidenceId,review.verification!.packetDigest,JSON.stringify(review.verification)]):await db.query('INSERT INTO engineering.founder_decisions(task_id,actor_id,request_id,payload_hash,reviewed_revision,recorded_revision,decision,review_digest,head_commit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',values);
  const result=await oldDecision(db,actor,parsed,hash);if(!result||result.id!==saved.rows[0].id)throw new LedgerError('DECISION_UNAVAILABLE');return result;
 });
}
