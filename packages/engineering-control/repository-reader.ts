import {z} from 'zod';
import {boundedEngineeringText} from './transport';
import {repositoryInspectionInput,repositoryInspectionSchema} from './repository-contract';
const repository='tuxfastai-pixel/SpaceCase-' as const,api=`https://api.github.com/repos/${repository}`,sha=z.string().regex(/^[a-f0-9]{40}$/);
const prSchema=z.object({number:z.number().int().positive(),state:z.enum(['open','closed']),merged:z.boolean(),draft:z.boolean(),head:z.object({sha,ref:z.string().max(250)}),base:z.object({sha,ref:z.string().max(200),repo:z.object({full_name:z.literal(repository)})})});
const runSchema=z.object({id:z.number().int().positive(),event:z.string().max(60),head_sha:sha,path:z.string().max(300),run_number:z.number().int().positive(),run_attempt:z.number().int().positive(),status:z.string().max(60),conclusion:z.string().max(60).nullable(),repository:z.object({full_name:z.literal(repository)}),pull_requests:z.array(z.object({number:z.number().int().positive(),head:z.object({sha}),base:z.object({sha})})).max(100).default([])});
const runsSchema=z.object({total_count:z.number().int().nonnegative(),workflow_runs:z.array(runSchema).max(100)});
export class RepositoryReadError extends Error{}
// Public GitHub metadata only. No session, signing key, source narrative or arbitrary URL.
export async function inspectRepository(input:z.infer<typeof repositoryInspectionInput>,deps:{fetch:typeof fetch;now:()=>Date}={fetch,now:()=>new Date()}){
 const parsed=repositoryInspectionInput.parse(input),signal=AbortSignal.timeout(7000);
 async function read(path:string){
  let response:Response;try{response=await deps.fetch(api+path,{method:'GET',headers:{accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'},redirect:'error',credentials:'omit',cache:'no-store',signal});}catch{throw new RepositoryReadError('REPOSITORY_UNAVAILABLE');}
  if(response.status===429||(response.status===403&&(response.headers.get('x-ratelimit-remaining')==='0'||response.headers.has('retry-after'))))throw new RepositoryReadError('REPOSITORY_RATE_LIMITED');
  if(response.status===404)throw new RepositoryReadError('REPOSITORY_REFERENCE_UNAVAILABLE');
  if(!response.ok)throw new RepositoryReadError('REPOSITORY_UNAVAILABLE');
  try{return JSON.parse(await boundedEngineeringText(response,1048576));}catch{throw new RepositoryReadError('REPOSITORY_UNAVAILABLE');}
 }
 try{
  const before=prSchema.parse(await read(`/pulls/${parsed.pullRequest}`));if(before.number!==parsed.pullRequest)throw Error();
  const [pushData,prData]=await Promise.all([
   read(`/actions/workflows/validate.yml/runs?event=push&head_sha=${before.head.sha}&per_page=100`),
   read(`/actions/workflows/validate.yml/runs?event=pull_request&branch=${encodeURIComponent(before.head.ref)}&per_page=100`),
  ]);
  const pushes=runsSchema.parse(pushData),pulls=runsSchema.parse(prData);
  if(pushes.workflow_runs.some(r=>r.event!=='push'||r.head_sha!==before.head.sha||r.path.split('@')[0]!=='.github/workflows/validate.yml')||pulls.workflow_runs.some(r=>r.event!=='pull_request'||r.path.split('@')[0]!=='.github/workflows/validate.yml'))throw Error();
  const correlated=pulls.workflow_runs.filter(r=>r.pull_requests.some(p=>p.number===parsed.pullRequest&&p.head.sha===before.head.sha&&p.base.sha===before.base.sha));
  const after=prSchema.parse(await read(`/pulls/${parsed.pullRequest}`));if(JSON.stringify(before)!==JSON.stringify(after))throw new RepositoryReadError('REPOSITORY_CHANGED');
  const latest=[...pushes.workflow_runs,...correlated].sort((a,b)=>b.run_number-a.run_number||b.run_attempt-a.run_attempt||b.id-a.id).filter((r,i,all)=>all.findIndex(other=>other.event===r.event)===i);
  const incomplete=[pushes,pulls].some(group=>group.total_count>group.workflow_runs.length||group.total_count<group.workflow_runs.length);
  const validation=incomplete?'INCOMPLETE':!correlated.length?'MISSING':latest.some(r=>r.status!=='completed')?'PENDING':latest.some(r=>r.conclusion!=='success')?'FAILED':'PASSED';
  const blockers=[];
  if(after.head.sha!==parsed.expectedHeadCommit)blockers.push('HEAD_CHANGED');if(after.state!=='open')blockers.push('PR_NOT_OPEN');if(after.draft)blockers.push('DRAFT_PR');if(after.base.ref!=='main')blockers.push('BASE_BRANCH_NOT_MAIN');
  if(validation!=='PASSED')blockers.push(`VALIDATION_${validation}`);
  return repositoryInspectionSchema.parse({repository,pullRequest:parsed.pullRequest,expectedHeadCommit:parsed.expectedHeadCommit,headCommit:after.head.sha,baseCommit:after.base.sha,state:after.merged?'MERGED':after.state.toUpperCase(),draft:after.draft,baseBranch:after.base.ref,validation,runs:latest.map(r=>({id:r.id,event:r.event,attempt:r.run_attempt,status:r.status,conclusion:r.conclusion})),blockers,observedAt:deps.now().toISOString(),taskAssociationVerified:false,codeReviewVerified:false,executionStarted:false,releasePermission:false});
 }catch(error){if(error instanceof RepositoryReadError)throw error;throw new RepositoryReadError('REPOSITORY_UNAVAILABLE');}
}
