import {createHash} from 'node:crypto';
import {z} from 'zod';
const sha=z.string().regex(/^[a-f0-9]{40}$/),digest=z.string().regex(/^[a-f0-9]{64}$/);
export const reviewEvidenceSchema=z.object({
 version:z.literal('psg.engineering-review.v1'),taskId:z.string().uuid(),project:z.literal('SPACECASE'),repository:z.literal('tuxfastai-pixel/SpaceCase-'),handoffDigest:digest,sourceRevision:z.number().int().nonnegative(),baseCommit:sha,headCommit:sha,pullRequest:z.number().int().positive(),
 authorId:z.string().uuid(),reviewerId:z.string().uuid(),reviewerDecision:z.enum(['APPROVE','CHANGES_REQUESTED','PENDING']),unresolvedFindings:z.number().int().nonnegative(),
 reproduction:z.enum(['REPRODUCED','NOT_REPRODUCED','UNVERIFIED']),rollbackReviewed:z.boolean(),
 validation:z.object({runId:z.number().int().positive(),workflow:z.literal('Validate'),headCommit:sha,conclusion:z.enum(['SUCCESS','FAILURE','CANCELLED','SKIPPED','PENDING'])}).strict(),
}).strict();
export type ReviewEvidence=z.infer<typeof reviewEvidenceSchema>;
export type ReviewContext={founder:boolean;personId:string;taskId:string;handoffDigest:string;sourceRevision:number;sourceOpen:boolean;briefAvailable:boolean;taskState:'BLOCKED'|'CANCELLED';currentHeadCommit:string;baseCommit:string};
// Pure readiness policy: its caller must obtain identities, PR head, reviews and checks
// from authenticated authoritative adapters. This function is not proof of provenance.
export function evaluateReviewReadiness(input:ReviewEvidence,c:ReviewContext){
 if(!c.founder)throw Error('FOUNDER_REQUIRED');const e=reviewEvidenceSchema.parse(input),blockers:string[]=[];
 if(e.taskId!==c.taskId||e.handoffDigest!==c.handoffDigest||e.sourceRevision!==c.sourceRevision||e.baseCommit!==c.baseCommit)blockers.push('SOURCE_BINDING_CHANGED');
 if(c.taskState!=='BLOCKED')blockers.push('TASK_NOT_REVIEWABLE');
 if(!c.sourceOpen)blockers.push('CASE_CLOSED');if(!c.briefAvailable)blockers.push('BRIEF_EXPIRED');
 if(e.headCommit!==c.currentHeadCommit||e.validation.headCommit!==e.headCommit)blockers.push('COMMIT_CHANGED');
 if(e.authorId===e.reviewerId)blockers.push('INDEPENDENT_REVIEW_REQUIRED');
 if(e.reviewerDecision!=='APPROVE'||e.unresolvedFindings>0)blockers.push('REVIEW_UNRESOLVED');
 if(e.validation.conclusion!=='SUCCESS')blockers.push('VALIDATION_REQUIRED');
 if(e.reproduction!=='REPRODUCED')blockers.push('REPRODUCTION_REQUIRED');if(!e.rollbackReviewed)blockers.push('ROLLBACK_REQUIRED');
 return {ready:blockers.length===0,blockers,reviewDigest:createHash('sha256').update(JSON.stringify(e)).digest('hex'),headCommit:e.headCommit,pullRequestUrl:`https://github.com/tuxfastai-pixel/SpaceCase-/pull/${e.pullRequest}`,executionStarted:false as const};
}
export function prepareFounderDecision(input:ReviewEvidence,c:ReviewContext,reviewedDigest:string,decision:'APPROVED'|'CHANGES_REQUESTED'|'DEFERRED'|'DECLINED'){
 const result=evaluateReviewReadiness(input,c);
 if(result.reviewDigest!==digest.parse(reviewedDigest))throw Error('REVIEW_CHANGED');
 if(!['APPROVED','CHANGES_REQUESTED','DEFERRED','DECLINED'].includes(decision))throw Error('INVALID_DECISION');
 if(decision==='APPROVED'&&!result.ready)throw Error('REVIEW_NOT_READY');
 return {version:'psg.engineering-decision.v1' as const,taskId:c.taskId,actorId:z.string().uuid().parse(c.personId),decision,reviewDigest:result.reviewDigest,headCommit:result.headCommit,executionStarted:false as const,releasePermission:false as const};
}
