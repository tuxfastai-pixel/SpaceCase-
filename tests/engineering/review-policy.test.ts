import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {evaluateReviewReadiness,prepareFounderDecision,type ReviewContext,type ReviewEvidence} from '../../packages/engineering-control/review-policy';
const evidence:ReviewEvidence={version:'psg.engineering-review.v1',taskId:randomUUID(),taskRevision:0,project:'SPACECASE',repository:'tuxfastai-pixel/SpaceCase-',handoffDigest:'a'.repeat(64),sourceRevision:2,baseCommit:'b'.repeat(40),headCommit:'c'.repeat(40),pullRequest:33,authorId:randomUUID(),reviewerId:randomUUID(),reviewerDecision:'APPROVE',unresolvedFindings:0,reproduction:'REPRODUCED',rollbackReviewed:true,validation:{runId:123,workflow:'Validate',headCommit:'c'.repeat(40),conclusion:'SUCCESS'}};
const context:ReviewContext={founder:true,personId:randomUUID(),taskId:evidence.taskId,taskRevision:0,handoffDigest:evidence.handoffDigest,sourceRevision:2,sourceOpen:true,briefAvailable:true,taskState:'BLOCKED',currentHeadCommit:evidence.headCommit,baseCommit:evidence.baseCommit};
test('readiness binds exact source/head/checks and a founder decision never grants release execution',()=>{
 const ready=evaluateReviewReadiness(evidence,context);assert.equal(ready.ready,true);assert.equal(ready.executionStarted,false);
 const decision=prepareFounderDecision(evidence,context,ready.reviewDigest,'APPROVED');assert.equal(decision.headCommit,evidence.headCommit);assert.equal(decision.releasePermission,false);assert.equal(decision.actorId,context.personId);
 assert.throws(()=>prepareFounderDecision(evidence,context,'0'.repeat(64),'APPROVED'),/REVIEW_CHANGED/);
 assert.throws(()=>prepareFounderDecision(evidence,{...context,founder:false},ready.reviewDigest,'APPROVED'),/FOUNDER_REQUIRED/);
});
test('changed commits, source, expired briefs, self review and missing proof all block approval',()=>{
 const changes:Array<Partial<ReviewEvidence>>=[{reviewerId:evidence.authorId},{reviewerDecision:'PENDING'},{unresolvedFindings:1},{reproduction:'UNVERIFIED'},{rollbackReviewed:false},{headCommit:'d'.repeat(40)},{handoffDigest:'d'.repeat(64)},{validation:{...evidence.validation,conclusion:'SKIPPED'}},{validation:{...evidence.validation,headCommit:'e'.repeat(40)}}];
 for(const delta of changes){const changed={...evidence,...delta},result=evaluateReviewReadiness(changed,context);assert.equal(result.ready,false);assert.throws(()=>prepareFounderDecision(changed,context,result.reviewDigest,'APPROVED'),/REVIEW_NOT_READY/);}
 for(const delta of [{taskRevision:1},{taskState:'CANCELLED' as const},{sourceOpen:false},{briefAvailable:false},{sourceRevision:3},{currentHeadCommit:'d'.repeat(40)}])assert.equal(evaluateReviewReadiness(evidence,{...context,...delta}).ready,false);
});
test('review contracts reject cross-project input and injected execution authority',()=>{
 for(const delta of [{project:'PEOS'},{repository:'other/repo'},{releasePermission:true},{headCommit:'main'}])assert.throws(()=>evaluateReviewReadiness({...evidence,...delta} as ReviewEvidence,context));
});
