import {linkedTaskSchema,linkedReviewSchema,recordedDecisionSchema} from '../../packages/engineering-control/linked-review-contract';
import {z} from 'zod';import type {Pool} from 'pg';
import {assertFounder,SupportError,type SupportContext} from '../../domains/support/contracts';
import {boundedEngineeringText,engineeringSigningKey} from '../../packages/engineering-control/transport';
import {signTaskControl} from '../../packages/engineering-control/control-transport';
import {taskListSchema,taskHistorySchema,type EngineeringControlInput} from '../../packages/engineering-control/control-contract';
import {savedTaskSchema} from '../../packages/engineering-control/result';
export const taskControlInput=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('LIST'),ticketId:z.string().uuid(),offset:z.number().int().min(0).max(10000).default(0)}).strict(),
 z.object({operation:z.literal('HISTORY'),ticketId:z.string().uuid(),taskId:z.string().uuid()}).strict(),
 z.object({operation:z.literal('LINK'),ticketId:z.string().uuid(),taskId:z.string().uuid(),revision:z.number().int().nonnegative(),pullRequest:z.number().int().positive().max(100000000),headCommit:z.string().regex(/^[a-f0-9]{40}$/)}).strict(),
 z.object({operation:z.literal('REVIEW'),ticketId:z.string().uuid(),taskId:z.string().uuid()}).strict(),
 z.object({operation:z.literal('DECIDE'),ticketId:z.string().uuid(),taskId:z.string().uuid(),revision:z.number().int().nonnegative(),requestId:z.string().uuid(),reviewDigest:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['APPROVED','CHANGES_REQUESTED','DEFERRED','DECLINED'])}).strict(),
 z.object({operation:z.literal('CANCEL'),ticketId:z.string().uuid(),taskId:z.string().uuid(),revision:z.number().int().nonnegative()}).strict(),
]);
export async function controlEngineeringTask(pool:Pool,c:SupportContext,input:z.infer<typeof taskControlInput>,deps={env:()=>process.env as Readonly<Record<string,string|undefined>>,fetch,now:()=>Math.floor(Date.now()/1000)}){
 assertFounder(c);const parsed=taskControlInput.parse(input),env=deps.env();
 if(parsed.operation==='DECIDE'&&parsed.decision==='APPROVED')throw new SupportError('ENGINEERING_REVIEW_NOT_READY',409);
 if(env.VERCEL_ENV!=='production'||env.SPACECASE_ENGINEERING_LEDGER_ENABLED!=='true'||!env.PSG_ENGINEERING_BASE_URL||!env.SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY)throw new SupportError('ENGINEERING_LEDGER_DISABLED',503);
 let origin:URL,key;
 try{origin=new URL(env.PSG_ENGINEERING_BASE_URL);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash)throw Error();key=engineeringSigningKey(env.SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY);}catch{throw new SupportError('ENGINEERING_LEDGER_DISABLED',503);}
 // Only the opaque reference is needed. Closed tickets may still cancel blocked work.
 const reviewOperation=['LINK','REVIEW','DECIDE'].includes(parsed.operation);
 const source=await pool.query(reviewOperation?'SELECT reference,revision,status FROM support.tickets WHERE id=$1':'SELECT reference FROM support.tickets WHERE id=$1',[parsed.ticketId]);if(!source.rowCount)throw new SupportError('TICKET_UNAVAILABLE',404);
 const reference=source.rows[0].reference;
 let control:EngineeringControlInput;
 const currentSource={sourceReference:reference,sourceRevision:source.rows[0].revision,sourceOpen:!['CLOSED','RESOLVED'].includes(source.rows[0].status)};
 if(parsed.operation==='LINK')control={purpose:'LINK_PULL_REQUEST',...currentSource,taskId:parsed.taskId,revision:parsed.revision,pullRequest:parsed.pullRequest,headCommit:parsed.headCommit};
 else if(parsed.operation==='REVIEW')control={purpose:'READ_LINKED_REVIEW',...currentSource,taskId:parsed.taskId};
 else if(parsed.operation==='DECIDE')control={purpose:'RECORD_REVIEW_DECISION',...currentSource,taskId:parsed.taskId,revision:parsed.revision,requestId:parsed.requestId,reviewDigest:parsed.reviewDigest,decision:parsed.decision};
 else control=parsed.operation==='LIST'?{purpose:'LIST_TICKET_TASKS',sourceReference:reference,offset:parsed.offset}:parsed.operation==='HISTORY'?{purpose:'READ_TASK_HISTORY',sourceReference:reference,taskId:parsed.taskId}:{purpose:'CANCEL_TASK',sourceReference:reference,taskId:parsed.taskId,revision:parsed.revision};
 const attestation=signTaskControl(control,{founder:c.founder,personId:c.personId},key,deps.now());
 try{
  const response=await deps.fetch(new URL('/v1/engineering/task-control',origin),{method:'POST',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({attestation}),signal:AbortSignal.timeout(reviewOperation?25000:10000)});
  if(reviewOperation&&!response.ok){const error=JSON.parse(await boundedEngineeringText(response,4096));const codes:Record<string,string>={TASK_CHANGED:'ENGINEERING_TASK_CHANGED',TASK_NOT_BLOCKED:'ENGINEERING_TASK_CHANGED',SOURCE_CHANGED:'ENGINEERING_SOURCE_CHANGED',CASE_CLOSED:'CASE_CLOSED',BRIEF_EXPIRED:'ENGINEERING_BRIEF_EXPIRED',LINK_UNCHANGED:'ENGINEERING_LINK_UNCHANGED',LINK_REFERENCE_CHANGED:'ENGINEERING_LINK_CHANGED',LINK_BASE_CHANGED:'ENGINEERING_LINK_BASE_CHANGED',REVIEW_CHANGED:'ENGINEERING_REVIEW_CHANGED',REVIEW_NOT_READY:'ENGINEERING_REVIEW_NOT_READY',REQUEST_REUSED:'ENGINEERING_REQUEST_CONFLICT',TASK_UNAVAILABLE:'ENGINEERING_TASK_UNAVAILABLE',REPOSITORY_REFERENCE_UNAVAILABLE:'REPOSITORY_REFERENCE_UNAVAILABLE',REPOSITORY_CHANGED:'REPOSITORY_CHANGED',REPOSITORY_UNAVAILABLE:'REPOSITORY_UNAVAILABLE',REPOSITORY_RATE_LIMITED:'REPOSITORY_RATE_LIMITED'};throw new SupportError(codes[error.error]??'ENGINEERING_LEDGER_UNAVAILABLE',[404,409,429].includes(response.status)?response.status:503);}
  if(response.status===409)throw new SupportError('ENGINEERING_TASK_CHANGED',409);if(response.status===404)throw new SupportError('ENGINEERING_TASK_UNAVAILABLE',404);if(!response.ok)throw Error();
  const raw=JSON.parse(await boundedEngineeringText(response,32768));
  if(parsed.operation==='LINK'){const result=linkedTaskSchema.parse(raw);if(result.taskId!==parsed.taskId||result.sourceReference!==reference||result.taskRevision!==parsed.revision+1||result.link?.pullRequest!==parsed.pullRequest||result.link.headCommit!==parsed.headCommit||result.link.linkedRevision!==result.taskRevision)throw Error();return result;}
  if(parsed.operation==='REVIEW'){const result=linkedReviewSchema.parse(raw);if(result.task.taskId!==parsed.taskId||result.task.sourceReference!==reference||result.currentSource.revision!==currentSource.sourceRevision||result.currentSource.open!==currentSource.sourceOpen)throw Error();return result;}
  if(parsed.operation==='DECIDE'){const result=recordedDecisionSchema.parse(raw);if(result.taskId!==parsed.taskId||result.sourceReference!==reference||result.requestId!==parsed.requestId||result.reviewedRevision!==parsed.revision||result.recordedRevision!==parsed.revision+1||result.reviewDigest!==parsed.reviewDigest||result.decision!==parsed.decision)throw Error();return result;}
  if(parsed.operation==='HISTORY'){const result=taskHistorySchema.parse(raw);if(result.taskId!==parsed.taskId||result.sourceReference!==reference)throw Error();return result;}
  if(parsed.operation==='LIST'){const result=taskListSchema.parse(raw);if(result.tasks.some(t=>t.sourceReference!==reference)||(result.nextOffset!==null&&result.nextOffset!==parsed.offset+25))throw Error();return result;}
  const result=savedTaskSchema.parse(raw);if(result.task.id!==parsed.taskId||result.task.sourceReference!==reference||result.task.state!=='CANCELLED'||result.task.revision!==parsed.revision+1)throw Error();return result;
 }catch(error){if(error instanceof SupportError)throw error;throw new SupportError('ENGINEERING_LEDGER_UNAVAILABLE',503);}
}
