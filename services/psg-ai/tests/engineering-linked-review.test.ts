import test from 'node:test';import assert from 'node:assert/strict';import {createHash,generateKeyPairSync,randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {createHandoff} from '../../../packages/engineering-control/contracts';import {repositoryInspectionSchema} from '../../../packages/engineering-control/repository-contract';import {signTaskControl} from '../../../packages/engineering-control/control-transport';
import {engineeringControlHandler} from '../lib/engineering/control-http';import {migrateEngineering} from '../db/migrate-ledger';import {saveBlockedTask,readTaskHistory,cancelBlockedTask} from '../lib/engineering/ledger';import {linkPullRequest,readLinkedReview,readLinkedTask,recordReviewDecision} from '../lib/engineering/linked-review';
const actor={founder:true,personId:randomUUID(),sourceOpen:true,sourceRevision:0};
const base='a'.repeat(40),head='b'.repeat(40);
function snapshot(input:{pullRequest:number;expectedHeadCommit:string}){return repositoryInspectionSchema.parse({repository:'tuxfastai-pixel/SpaceCase-',pullRequest:input.pullRequest,expectedHeadCommit:input.expectedHeadCommit,headCommit:head,baseCommit:base,state:'OPEN',draft:false,baseBranch:'main',validation:'PASSED',runs:[],blockers:[],observedAt:new Date().toISOString(),taskAssociationVerified:false,codeReviewVerified:false,executionStarted:false,releasePermission:false});}
const deps={inspect:async(input:{pullRequest:number;expectedHeadCommit:string})=>snapshot(input),now:()=>new Date()};
test('link/review/decision boundaries deny non-founder and unverified approval before storage',async()=>{
 const pool={connect:async()=>{throw Error('unexpected pool');}} as unknown as Pool;const scope={taskId:randomUUID(),sourceReference:'SC-ABCDEF012345'};
 await assert.rejects(readLinkedTask(pool,{...actor,founder:false},scope),/FOUNDER_REQUIRED/);
 await assert.rejects(recordReviewDecision(pool,actor,{...scope,revision:0,requestId:randomUUID(),reviewDigest:'a'.repeat(64),decision:'APPROVED'}),/REVIEW_NOT_READY/);
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');let pooled=false;
 const handler=engineeringControlHandler({env:()=>({VERCEL_ENV:'production',PSG_ENGINEERING_LEDGER_ENABLED:'true',PSG_ENGINEERING_SIGNING_PUBLIC_KEY:publicKey.export({type:'spki',format:'pem'}).toString()}),pool:()=>{pooled=true;throw Error('unexpected');},now:()=>1000});
 const token=signTaskControl({purpose:'RECORD_REVIEW_DECISION',...scope,sourceRevision:0,sourceOpen:true,revision:0,requestId:randomUUID(),reviewDigest:'a'.repeat(64),decision:'APPROVED'},actor,privateKey,1000);
 assert.equal((await handler(new Request('https://psg.test/v1/engineering/task-control',{method:'POST',body:JSON.stringify({attestation:token})}))).status,409);assert.equal(pooled,false);
});
test('durable PR links, summary binding and decision retries preserve privacy and audit history',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL},async()=>{
 const owner=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL}),pool=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL,options:'-c role=psg_engineering_runtime'});
 try{await migrateEngineering(owner);const reference=`SC-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
 const handoff=createHandoff({reference,revision:0,category:'BUG',area:'OTHER'},{problem:'Synthetic reviewed problem only.',expected:'A linked task remains reviewable.',observed:'An unlinked synthetic task.',steps:['Save the synthetic task.'],acceptance:['Link a current reviewed commit.']});
 const saved=await saveBlockedTask(pool,actor,{requestId:randomUUID(),request:{handoff,digest:createHash('sha256').update(JSON.stringify(handoff)).digest('hex'),baseCommit:base}}),scope={taskId:saved.task.id,sourceReference:reference};
 const empty=await readLinkedReview(pool,actor,scope,deps);assert.equal(empty.task.link,null);assert.ok(empty.blockers.includes('PR_NOT_LINKED'));assert.equal(empty.approvalAvailable,false);
 let inspected=0;const reader=async(input:{pullRequest:number;expectedHeadCommit:string})=>{inspected++;return snapshot(input);};
 const link={...scope,revision:0,pullRequest:37,headCommit:head};await assert.rejects(linkPullRequest(pool,actor,{...link,sourceReference:'SC-000000000000'},reader),/TASK_UNAVAILABLE/);assert.equal(inspected,0);
 await assert.rejects(linkPullRequest(pool,{...actor,sourceRevision:1},link,reader),/SOURCE_CHANGED/);await assert.rejects(linkPullRequest(pool,{...actor,sourceOpen:false},link,reader),/CASE_CLOSED/);
 await assert.rejects(linkPullRequest(pool,actor,link,async input=>({...snapshot(input),headCommit:base})),/LINK_REFERENCE_CHANGED/);await assert.rejects(linkPullRequest(pool,actor,link,async input=>({...snapshot(input),baseCommit:head})),/LINK_BASE_CHANGED/);
 const linked=await Promise.all([linkPullRequest(pool,actor,link,reader),linkPullRequest(pool,actor,link,reader)]);assert.ok(linked.every(value=>value.taskRevision===1&&value.link?.headCommit===head));
 assert.equal((await owner.query("SELECT count(*)::int AS n FROM engineering.review_events WHERE task_id=$1 AND kind='PR_LINKED'",[scope.taskId])).rows[0].n,1);
 await assert.rejects(linkPullRequest(pool,actor,{...link,revision:1},reader),/LINK_UNCHANGED/);
 const review=await readLinkedReview(pool,actor,scope,deps);assert.equal(review.repository?.validation,'PASSED');assert.equal(review.approvalAvailable,false);assert.equal(review.releasePermission,false);assert.ok(review.blockers.includes('CODE_REVIEW_UNVERIFIED'));assert.equal(JSON.stringify(review).includes(actor.personId),false);assert.equal(JSON.stringify(review).includes(handoff.brief.problem),false);
 assert.equal((await readLinkedReview(pool,actor,scope,deps)).reviewDigest,review.reviewDigest);assert.notEqual((await readLinkedReview(pool,{...actor,sourceRevision:1},scope,deps)).reviewDigest,review.reviewDigest);
 assert.notEqual((await readLinkedReview(pool,{...actor,sourceRevision:1},scope,deps)).reviewDigest,(await readLinkedReview(pool,{...actor,sourceRevision:2},scope,deps)).reviewDigest);
 const moved=await readLinkedReview(pool,actor,scope,{...deps,inspect:async input=>({...snapshot(input),headCommit:base})});assert.ok(moved.blockers.includes('HEAD_CHANGED'));
 const decision={...scope,revision:1,requestId:randomUUID(),reviewDigest:review.reviewDigest,decision:'DEFERRED' as const};
 await assert.rejects(recordReviewDecision(pool,{...actor,sourceRevision:1},decision,deps),/REVIEW_CHANGED/);
 const results=await Promise.all([recordReviewDecision(pool,actor,decision,deps),recordReviewDecision(pool,actor,decision,deps)]);assert.equal(results[0].id,results[1].id);assert.equal(results[0].recordedRevision,2);
 assert.equal((await recordReviewDecision(pool,actor,decision,deps)).id,results[0].id);await assert.rejects(recordReviewDecision(pool,actor,{...decision,decision:'DECLINED'},deps),/REQUEST_REUSED/);
 const current=await readLinkedReview(pool,actor,scope,deps);assert.equal(current.decisions[0].decision,'DEFERRED');assert.equal(current.task.taskRevision,2);assert.notEqual(current.reviewDigest,review.reviewDigest);
 const history=await readTaskHistory(pool,actor,scope);assert.deepEqual(history.events.map(row=>row.kind),['DECISION_RECORDED','PR_LINKED','CREATED']);
 await assert.rejects(pool.query('DELETE FROM engineering.pull_request_links WHERE task_id=$1',[scope.taskId]),/permission denied/);await assert.rejects(pool.query('UPDATE engineering.founder_decisions SET decision=$2 WHERE task_id=$1',[scope.taskId,'DECLINED']),/permission denied/);
 const client=await pool.connect();try{await client.query('BEGIN');await client.query("INSERT INTO engineering.review_events(task_id,actor_id,kind,revision) VALUES($1,$2,'DECISION_RECORDED',3)",[scope.taskId,actor.personId]);await assert.rejects(client.query("INSERT INTO engineering.founder_decisions(task_id,actor_id,request_id,payload_hash,reviewed_revision,recorded_revision,decision,review_digest,head_commit) VALUES($1,$2,$3,$4,2,3,'APPROVED',$4,$5)",[scope.taskId,actor.personId,randomUUID(),'a'.repeat(64),head]),/check constraint/);}finally{await client.query('ROLLBACK');client.release();}
 await cancelBlockedTask(pool,actor,{taskId:scope.taskId,revision:2});assert.ok((await readLinkedReview(pool,actor,scope,deps)).blockers.includes('TASK_CANCELLED'));assert.equal((await readLinkedTask(pool,actor,scope)).link?.pullRequest,37);
 await owner.query("UPDATE engineering.tasks SET brief_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[scope.taskId]);await pool.query('SELECT engineering.expire_briefs(500)');
 const expired=await readLinkedReview(pool,actor,scope,deps);assert.ok(expired.blockers.includes('BRIEF_EXPIRED'));assert.equal(expired.decisions[0].id,results[0].id);assert.equal(expired.task.link?.headCommit,head);
 }finally{await owner.end();await pool.end();}
});
