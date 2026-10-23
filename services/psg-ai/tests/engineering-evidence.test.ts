import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {migrateEngineering} from '../db/migrate-ledger';import {saveBlockedTask,readTaskHistory,cancelBlockedTask} from '../lib/engineering/ledger';import {linkPullRequest} from '../lib/engineering/linked-review';import {saveEvidence,listEvidence} from '../lib/engineering/evidence-records';
import {createHandoff} from '../../../packages/engineering-control/contracts';import {collectEvidencePacket} from '../../../packages/engineering-control/evidence-packet';
import {repositoryInspectionSchema} from '../../../packages/engineering-control/repository-contract';
const actor={founder:true,personId:randomUUID(),sourceRevision:0,sourceOpen:true},base='a'.repeat(40),head='b'.repeat(40);
const content={privacyReviewed:true as const,reproduction:{steps:'Run synthetic retry test',expected:'One record',before:'Duplicate',after:'One record',acceptance:[{criterion:'Same reference',result:'PASS' as const}],artifacts:[{kind:'TEST_LOG' as const,sha256:'c'.repeat(64)}]},rollback:{plan:'Restore prior code',trigger:'Regression',verification:'Run health checks',dataImpact:'NONE' as const,artifacts:[{kind:'ROLLBACK_PLAN' as const,sha256:'d'.repeat(64)}]}};
test('evidence service rejects non-founder and injected verification before storage',async()=>{
 const pool={connect:async()=>{throw Error('unexpected');}} as unknown as Pool,scope={taskId:randomUUID(),sourceReference:'SC-123456ABCDEF'};
 await assert.rejects(listEvidence(pool,{...actor,founder:false},scope),/FOUNDER_REQUIRED/);
 await assert.rejects(saveEvidence(pool,{...actor,founder:false},{...scope,revision:0,requestId:randomUUID(),content}),/FOUNDER_REQUIRED/);
 await assert.rejects(saveEvidence(pool,actor,{...scope,revision:0,requestId:randomUUID(),content:{...content,verified:true}} as never));
});
test('evidence storage binds the current task, retries atomically, expires details and preserves audit metadata',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL},async()=>{
 const owner=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL}),runtime=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL,options:'-c role=psg_engineering_runtime'});
 try{await migrateEngineering(owner);
  const reference=`SC-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`,handoff=createHandoff({reference,revision:0,category:'BUG',area:'OTHER'},{problem:'Synthetic evidence case.',expected:'One durable packet.',observed:'No packet yet.',steps:['Save task.'],acceptance:['Append unverified proof.']});
  const saved=await saveBlockedTask(runtime,actor,{requestId:randomUUID(),request:{handoff,digest:createHash('sha256').update(JSON.stringify(handoff)).digest('hex'),baseCommit:base}}),scope={taskId:saved.task.id,sourceReference:reference};
  const input={...scope,revision:0,requestId:randomUUID(),content};
  await assert.rejects(saveEvidence(runtime,actor,input),/PR_NOT_LINKED/);
  await linkPullRequest(runtime,actor,{...scope,revision:0,pullRequest:39,headCommit:head},async i=>repositoryInspectionSchema.parse({repository:'tuxfastai-pixel/SpaceCase-',pullRequest:i.pullRequest,expectedHeadCommit:i.expectedHeadCommit,headCommit:head,baseCommit:base,state:'OPEN',draft:false,baseBranch:'main',validation:'PASSED',runs:[],blockers:[],observedAt:new Date().toISOString(),taskAssociationVerified:false,codeReviewVerified:false,executionStarted:false,releasePermission:false}));
  const submit={...input,revision:1};
  await assert.rejects(saveEvidence(runtime,{...actor,sourceRevision:1},submit),/SOURCE_CHANGED/);await assert.rejects(saveEvidence(runtime,{...actor,sourceOpen:false},submit),/CASE_CLOSED/);
  await assert.rejects(saveEvidence(runtime,actor,{...submit,sourceReference:'SC-000000000000'}),/TASK_UNAVAILABLE/);
  const results=await Promise.all([saveEvidence(runtime,actor,submit),saveEvidence(runtime,actor,submit)]);assert.equal(results[0].id,results[1].id);assert.equal(results[0].recordedRevision,2);assert.equal(results[0].verification,'UNVERIFIED');
  const listed=await listEvidence(runtime,actor,scope);assert.equal(listed.records.length,1);assert.equal(listed.records[0].packet?.binding.headCommit,head);assert.equal(listed.records[0].packet?.binding.taskRevision,2);assert.equal(collectEvidencePacket(listed.records[0].packet).packetDigest,results[0].packetDigest);assert.equal(JSON.stringify(listed).includes(actor.personId),false);
  await assert.rejects(saveEvidence(runtime,actor,{...submit,content:{...content,rollback:{...content.rollback,plan:'Changed'}}}),/REQUEST_REUSED/);
  await assert.rejects(saveEvidence(runtime,actor,{...submit,requestId:randomUUID()}),/TASK_CHANGED/);
  await assert.rejects(listEvidence(runtime,actor,{...scope,sourceReference:'SC-000000000000'}),/TASK_UNAVAILABLE/);
  assert.equal((await readTaskHistory(runtime,actor,scope)).events[0].kind,'EVIDENCE_SUBMITTED');
  await assert.rejects(runtime.query('UPDATE engineering.evidence_records SET packet=NULL WHERE task_id=$1',[scope.taskId]),/permission denied/);await assert.rejects(runtime.query('DELETE FROM engineering.evidence_records WHERE task_id=$1',[scope.taskId]),/permission denied/);
  await cancelBlockedTask(runtime,actor,{taskId:scope.taskId,revision:2});assert.equal((await saveEvidence(runtime,actor,submit)).id,results[0].id);
  await owner.query("UPDATE engineering.evidence_records SET recorded_at=statement_timestamp()-interval '8 days',expires_at=statement_timestamp()-interval '1 day' WHERE task_id=$1",[scope.taskId]);
  assert.equal((await listEvidence(runtime,actor,scope)).records[0].packet,null);
  await Promise.all([runtime.query('SELECT engineering.expire_evidence(500)'),runtime.query('SELECT engineering.expire_evidence(500)')]);
  const stored=(await owner.query('SELECT packet,removed_at FROM engineering.evidence_records WHERE task_id=$1',[scope.taskId])).rows[0];assert.equal(stored.packet,null);assert.ok(stored.removed_at);assert.equal((await saveEvidence(runtime,actor,submit)).id,results[0].id);
  await assert.rejects(runtime.query('SELECT engineering.expire_evidence(501)'),/INVALID_BATCH_SIZE/);
 }finally{await owner.end();await runtime.end();}
});
