import test from 'node:test';import assert from 'node:assert/strict';import {createHandoff} from '../../packages/engineering-control/contracts';import {newSaveAttempt,confirmSavedTask} from '../../app/founder/engineering/saveAttempt';
const handoff=createHandoff({reference:'SC-ABCDEF012345',revision:2,category:'BUG',area:'OTHER'},{problem:'Synthetic date entry issue.',expected:'Focus moves to month.',observed:'Focus remains in year.',steps:['Enter four digits.'],acceptance:['Month gains focus.']});
const packet={handoff,digest:'a'.repeat(64)},id='11111111-1111-4111-8111-111111111111',commit='b'.repeat(40);
test('save attempt binds an explicit request reference and acknowledgement to the reviewed work',()=>{
 const attempt=newSaveAttempt(id,packet,commit,id);assert.equal(attempt.requestId,id);assert.equal(attempt.revision,2);assert.equal(attempt.consentToStore,true);assert.throws(()=>newSaveAttempt(id,packet,'main',id));
 const result={task:{id,project:'SPACECASE',sourceReference:handoff.source.reference,sourceRevision:2,handoffDigest:packet.digest,baseCommit:commit,state:'BLOCKED',revision:0,createdAt:'2026-10-22T10:00:00Z',cancelledAt:null,briefExpiresAt:'2026-10-29T10:00:00Z',briefAvailable:true},executionStarted:false};
 assert.deepEqual(confirmSavedTask(result,packet,commit),result);assert.throws(()=>confirmSavedTask({...result,executionStarted:true},packet,commit));
 for(const delta of [{sourceRevision:3},{handoffDigest:'c'.repeat(64)},{baseCommit:'c'.repeat(40)},{sourceReference:'SC-111111111111'}])assert.throws(()=>confirmSavedTask({...result,task:{...result.task,...delta}},packet,commit));
});
