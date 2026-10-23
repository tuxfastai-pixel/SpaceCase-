import {createHash} from 'node:crypto';
import {z} from 'zod';
import {boundedEngineeringText} from './transport';
import {evidencePacketSchema,type EvidencePacket} from './evidence-contract';
import {verifyEvidencePacket} from './evidence-packet';
import {repositoryInspectionSchema} from './repository-contract';

const repo='tuxfastai-pixel/SpaceCase-',api=`https://api.github.com/repos/${repo}`;
const sha=z.string().regex(/^[a-f0-9]{40}$/),number=z.number().int().positive().safe();
const prSchema=z.object({number,state:z.literal('open'),draft:z.literal(false),user:z.object({id:number}),head:z.object({sha}),base:z.object({sha,ref:z.literal('main'),repo:z.object({full_name:z.literal(repo),private:z.literal(false)})})});
const reviewSchema=z.object({id:number,user:z.object({id:number,type:z.string()}),author_association:z.string(),commit_id:sha,state:z.string(),body:z.string().max(65536).nullable(),submitted_at:z.string().datetime()});
const reviewsSchema=z.array(reviewSchema).max(100);
const jobsSchema=z.object({total_count:z.number().int().nonnegative(),jobs:z.array(z.object({id:number,run_id:number,status:z.string(),conclusion:z.string().nullable(),steps:z.array(z.object({name:z.string(),status:z.string(),conclusion:z.string().nullable()})).max(100)})).max(100)});
export type GithubEvidenceResult={evidenceVerified:boolean;blockers:string[];reviewId:number|null;reviewerGithubId:number|null;runIds:number[];artifactDigests:string[]};

// Public, fixed-repository GETs only. No token, arbitrary URL, source narrative or packet text leaves the service.
export async function verifyGithubEvidence(input:EvidencePacket,packetDigest:string,inspection:z.infer<typeof repositoryInspectionSchema>,deps:{fetch:typeof fetch;readToken?:string}={fetch,readToken:process.env.PSG_ENGINEERING_GITHUB_READ_TOKEN}):Promise<GithubEvidenceResult>{
 const packet=evidencePacketSchema.parse(input),binding=packet.binding,signal=AbortSignal.timeout(10000);
 inspection=repositoryInspectionSchema.parse(inspection);
 const result:GithubEvidenceResult={evidenceVerified:false,blockers:[],reviewId:null,reviewerGithubId:null,runIds:[],artifactDigests:[]};
 async function read(path:string,max=1048576){
  const response=await deps.fetch(api+path,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'}});
  if(response.status===429||(response.status===403&&(response.headers.get('x-ratelimit-remaining')==='0'||response.headers.has('retry-after'))))throw Error('GITHUB_RATE_LIMITED');
  if(!response.ok||response.headers.get('link')?.includes('rel="next"'))throw Error('GITHUB_EVIDENCE_UNAVAILABLE');
  return JSON.parse(await boundedEngineeringText(response,max));
 }
 async function threads(){
  if(!deps.readToken) return null;
  const token=z.string().min(20).max(4096).regex(/^[!-~]+$/).parse(deps.readToken);
  const response=await deps.fetch('https://api.github.com/graphql',{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({query:'query($number:Int!){repository(owner:"tuxfastai-pixel",name:"SpaceCase-"){pullRequest(number:$number){headRefOid baseRefOid reviewThreads(first:100){totalCount nodes{id isResolved} pageInfo{hasNextPage}}}}}',variables:{number:binding.pullRequest}})});
  if(!response.ok)throw Error('REVIEW_THREADS_UNVERIFIED');
  const data=z.object({data:z.object({repository:z.object({pullRequest:z.object({headRefOid:sha,baseRefOid:sha,reviewThreads:z.object({totalCount:z.number().int().nonnegative(),nodes:z.array(z.object({id:z.string().min(1).max(200),isResolved:z.boolean()})).max(100),pageInfo:z.object({hasNextPage:z.boolean()})})})})}),errors:z.array(z.unknown()).optional()}).parse(JSON.parse(await boundedEngineeringText(response,131072)));
  const pr=data.data.repository.pullRequest,items=pr.reviewThreads;
  if(data.errors?.length||pr.headRefOid!==binding.headCommit||pr.baseRefOid!==binding.baseCommit||items.pageInfo.hasNextPage||items.totalCount!==items.nodes.length||new Set(items.nodes.map(t=>t.id)).size!==items.nodes.length)throw Error('REVIEW_THREADS_UNVERIFIED');
  return items.nodes;
 }
 try{
  if(createHash('sha256').update(JSON.stringify(packet)).digest('hex')!==packetDigest)throw Error('EVIDENCE_DIGEST_CHANGED');
  if(inspection.repository!==repo||inspection.pullRequest!==binding.pullRequest||inspection.expectedHeadCommit!==binding.headCommit||inspection.headCommit!==binding.headCommit||inspection.baseCommit!==binding.baseCommit||inspection.validation!=='PASSED'||inspection.blockers.length||inspection.state!=='OPEN'||inspection.draft||inspection.baseBranch!=='main')throw Error('WORKFLOW_PROOF_REQUIRED');
  const pr=prSchema.parse(await read(`/pulls/${binding.pullRequest}`));
  if(pr.number!==binding.pullRequest||pr.head.sha!==binding.headCommit||pr.base.sha!==binding.baseCommit)throw Error('COMMIT_CHANGED');
  const reviews=reviewsSchema.parse(await read(`/pulls/${binding.pullRequest}/reviews?per_page=100`));
  if(reviews.length===100)throw Error('REVIEW_ENUMERATION_INCOMPLETE');
  const comments=z.array(z.object({id:number})).max(100).parse(await read(`/pulls/${binding.pullRequest}/comments?per_page=100`));
  // REST cannot establish resolution. Use the separately configured read-only GraphQL connection when needed.
  const threadState=comments.length?await threads():[];
  if(threadState===null)result.blockers.push('REVIEW_THREADS_UNVERIFIED');
  else if(threadState.some(t=>!t.isResolved))result.blockers.push('REVIEW_FINDINGS_OPEN');
  const latest=[...reviews].reverse().filter((r,i,all)=>all.findIndex(other=>other.user.id===r.user.id)===i);
  const trusted=(r:z.infer<typeof reviewSchema>)=>r.user.id!==pr.user.id&&r.user.type==='User'&&['OWNER','MEMBER','COLLABORATOR'].includes(r.author_association);
  if(latest.some(r=>trusted(r)&&r.state==='CHANGES_REQUESTED'))result.blockers.push('REVIEW_CHANGES_REQUESTED');
  const approved=latest.filter(r=>trusted(r)&&r.state==='APPROVED'&&r.commit_id===binding.headCommit);
  // The same independent reviewer must explicitly attest both parts of this exact packet.
  const reviewer=approved.find(r=>r.body?.split(/\r?\n/).includes(`PSG_REPRODUCTION_REVIEWED ${packetDigest}`)&&r.body.split(/\r?\n/).includes(`PSG_ROLLBACK_REVIEWED ${packetDigest}`));
  if(!approved.length)result.blockers.push('INDEPENDENT_CURRENT_REVIEW_REQUIRED');
  else if(!reviewer)result.blockers.push('EXPLICIT_PACKET_REVIEW_REQUIRED');
  const runs=inspection.runs;
  if(!runs.length||!runs.some(r=>r.event==='pull_request')||runs.some(r=>r.status!=='completed'||r.conclusion!=='success'))throw Error('WORKFLOW_PROOF_REQUIRED');
  for(const run of runs){
   const jobs=jobsSchema.parse(await read(`/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100`));
   if(jobs.total_count!==jobs.jobs.length||!jobs.jobs.length||jobs.jobs.some(j=>j.run_id!==run.id||j.status!=='completed'||j.conclusion!=='success'))throw Error('TEST_JOBS_UNVERIFIED');
   const validation=jobs.jobs.some(job=>['Test','PSG AI service checks'].every(name=>job.steps.some(step=>step.name===name&&step.status==='completed'&&step.conclusion==='success')));
   if(!validation)throw Error('TEST_JOBS_UNVERIFIED');result.runIds.push(run.id);
  }
  const all=[...packet.reproduction.artifacts,...packet.rollback.artifacts],unique=[...new Set(all.map(a=>a.sha256))];
  // At most twenty bounded immutable files; never follow a content download URL.
  for(let i=0;i<unique.length;i+=4){
   const checked=await Promise.all(unique.slice(i,i+4).map(async hash=>{
    const file=z.object({type:z.literal('file'),encoding:z.literal('base64'),size:z.number().int().min(1).max(16384),content:z.string().max(24000),path:z.literal(`.engineering/evidence/${hash}.txt`)}).parse(await read(`/contents/.engineering/evidence/${hash}.txt?ref=${binding.headCommit}`,32768));
    const encoded=file.content.replace(/\n/g,'');if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('ARTIFACT_BYTES_UNVERIFIED');
    const bytes=Buffer.from(encoded,'base64');if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('ARTIFACT_HASH_MISMATCH');return hash;
   }));result.artifactDigests.push(...checked);
  }
  // Re-read mutable authority/review facts after the immutable-file and workflow reads.
  const after=prSchema.parse(await read(`/pulls/${binding.pullRequest}`)),afterReviews=reviewsSchema.parse(await read(`/pulls/${binding.pullRequest}/reviews?per_page=100`)),afterComments=z.array(z.object({id:number})).max(100).parse(await read(`/pulls/${binding.pullRequest}/comments?per_page=100`));
  if(JSON.stringify(pr)!==JSON.stringify(after)||JSON.stringify(reviews)!==JSON.stringify(afterReviews)||JSON.stringify(comments)!==JSON.stringify(afterComments))throw Error('REVIEW_CHANGED_DURING_VERIFICATION');
  if(comments.length&&threadState!==null&&JSON.stringify(threadState)!==JSON.stringify(await threads()))throw Error('REVIEW_CHANGED_DURING_VERIFICATION');
  for(const run of runs){const current=z.object({id:number,run_attempt:number,status:z.literal('completed'),conclusion:z.literal('success'),event:z.string(),repository:z.object({full_name:z.literal(repo)})}).parse(await read(`/actions/runs/${run.id}`));if(current.id!==run.id||current.run_attempt!==run.attempt||current.event!==run.event)throw Error('TEST_JOBS_UNVERIFIED');}
  if(reviewer){result.reviewId=reviewer.id;result.reviewerGithubId=reviewer.user.id;}
  if(!reviewer)return result;
  const evaluated=await verifyEvidencePacket(packet,{founder:true,binding,sourceOpen:true,briefAvailable:true,taskState:'BLOCKED'},async()=>({packetDigest,binding,review:{authorGithubId:pr.user.id,reviewerGithubId:reviewer.user.id,reviewId:reviewer.id,commit:reviewer.commit_id,decision:'APPROVED',threadsComplete:threadState!==null,unresolvedFindings:threadState?.filter(t=>!t.isResolved).length??0},reproduction:{verifiedArtifactDigests:packet.reproduction.artifacts.map(a=>a.sha256),result:'PASS'},rollback:{verifiedArtifactDigests:packet.rollback.artifacts.map(a=>a.sha256),reviewed:true}}));
  result.blockers=[...new Set([...result.blockers,...evaluated.blockers])];result.evidenceVerified=result.blockers.length===0&&evaluated.evidenceVerified;
 }catch(error){const allowed=['REVIEW_THREADS_UNVERIFIED','EVIDENCE_DIGEST_CHANGED','GITHUB_RATE_LIMITED','GITHUB_EVIDENCE_UNAVAILABLE','WORKFLOW_PROOF_REQUIRED','COMMIT_CHANGED','REVIEW_ENUMERATION_INCOMPLETE','TEST_JOBS_UNVERIFIED','ARTIFACT_BYTES_UNVERIFIED','ARTIFACT_HASH_MISMATCH','REVIEW_CHANGED_DURING_VERIFICATION'];result.blockers.push(error instanceof Error&&allowed.includes(error.message)?error.message:'GITHUB_EVIDENCE_UNAVAILABLE');}
 return result;
}
