import {createHash} from 'node:crypto';
import {z} from 'zod';
import {createHandoff,handoffSchema} from './contracts';

// A preflight description, never a shell command or an execution credential.
export const runnerRequestSchema=z.object({
 handoff:handoffSchema,
 digest:z.string().regex(/^[a-f0-9]{64}$/),
 baseCommit:z.string().regex(/^[a-f0-9]{40}$/),
}).strict();
export type RunnerRequest=z.infer<typeof runnerRequestSchema>;
export type PreflightContext={founder:boolean;sourceRevision:number;sourceOpen:boolean};
export class RunnerPolicyError extends Error{}
export function prepareRunnerPlan(input:RunnerRequest,context:PreflightContext){
 if(!context.founder)throw new RunnerPolicyError('FOUNDER_REQUIRED');
 const request=runnerRequestSchema.parse(input);
 if(!context.sourceOpen)throw new RunnerPolicyError('CASE_CLOSED');
 if(context.sourceRevision!==request.handoff.source.revision)throw new RunnerPolicyError('TICKET_CHANGED');
 // Reconstruct policy-owned fields rather than trusting a copied document.
 const canonical=createHandoff(request.handoff.source,request.handoff.brief);
 if(JSON.stringify(request.handoff)!==JSON.stringify(canonical))throw new RunnerPolicyError('HANDOFF_POLICY_CHANGED');
 const digest=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
 if(digest!==request.digest)throw new RunnerPolicyError('HANDOFF_DIGEST_MISMATCH');
 return {
  version:'psg.engineering-runner-plan.v1' as const,
  repository:canonical.repository,baseCommit:request.baseCommit,handoffDigest:digest,
  isolation:{freshEnvironment:true,syntheticDataOnly:true,productionCredentials:false,network:'DENY_ALL' as const},
  limits:{wallSeconds:300,memoryMiB:512,outputBytes:65536,attempts:1,modelCalls:0},
  permissions:{repositoryRead:false,repositoryWrite:false,merge:false,deploy:false,email:false},
  state:'BLOCKED' as const,
  blockers:['DURABLE_LEDGER_NOT_CONNECTED','ISOLATED_RUNNER_NOT_CONNECTED','REPOSITORY_ACCESS_NOT_CONFIGURED'],
  executionStarted:false as const,
 };
}
