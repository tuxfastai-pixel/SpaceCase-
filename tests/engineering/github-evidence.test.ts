import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
import {verifyGithubEvidence} from '../../packages/engineering-control/github-evidence';import {collectEvidencePacket} from '../../packages/engineering-control/evidence-packet';import {repositoryInspectionSchema} from '../../packages/engineering-control/repository-contract';
const head='a'.repeat(40),base='b'.repeat(40),text='Synthetic test log and rollback proof.\n',hash=createHash('sha256').update(text).digest('hex');
const packet=collectEvidencePacket({version:'psg.engineering-evidence.v1',binding:{taskId:randomUUID(),taskRevision:2,sourceReference:'SC-123456ABCDEF',sourceRevision:0,handoffDigest:'c'.repeat(64),repository:'tuxfastai-pixel/SpaceCase-',pullRequest:41,baseCommit:base,headCommit:head},privacyReviewed:true,reproduction:{steps:'Synthetic test',expected:'One result',before:'Failure',after:'Pass',acceptance:[{criterion:'Synthetic scenario passes',result:'PASS'}],artifacts:[{kind:'TEST_LOG',sha256:hash}]},rollback:{plan:'Restore previous code',trigger:'Regression',verification:'Health check',dataImpact:'NONE',artifacts:[{kind:'ROLLBACK_PLAN',sha256:hash}]}});
const inspection=repositoryInspectionSchema.parse({repository:'tuxfastai-pixel/SpaceCase-',pullRequest:41,expectedHeadCommit:head,headCommit:head,baseCommit:base,state:'OPEN',draft:false,baseBranch:'main',validation:'PASSED',runs:[{id:12,event:'pull_request',attempt:1,status:'completed',conclusion:'success'}],blockers:[],observedAt:new Date().toISOString(),taskAssociationVerified:false,codeReviewVerified:false,executionStarted:false,releasePermission:false});
function fixtures(){return {
 pr:{number:41,state:'open',draft:false,user:{id:1},head:{sha:head},base:{sha:base,ref:'main',repo:{full_name:'tuxfastai-pixel/SpaceCase-',private:false}}},
 reviews:[{id:2,user:{id:3,type:'User'},author_association:'COLLABORATOR',commit_id:head,state:'APPROVED',body:`PSG_REPRODUCTION_REVIEWED ${packet.packetDigest}\nPSG_ROLLBACK_REVIEWED ${packet.packetDigest}`,submitted_at:'2026-10-23T06:00:00.000Z'}],
 comments:[] as Array<{id:number}>,jobs:{total_count:1,jobs:[{id:4,run_id:12,status:'completed',conclusion:'success',steps:[{name:'Test',status:'completed',conclusion:'success'},{name:'PSG AI service checks',status:'completed',conclusion:'success'}]}]},
 file:{type:'file',encoding:'base64',size:Buffer.byteLength(text),content:Buffer.from(text).toString('base64'),path:`.engineering/evidence/${hash}.txt`},
 threads:{data:{repository:{pullRequest:{headRefOid:head,baseRefOid:base,reviewThreads:{totalCount:1,nodes:[{id:'thread1',isResolved:true}],pageInfo:{hasNextPage:false}}}}}},
 };}
function reader(f=fixtures(),change?:(path:string,count:number)=>unknown){let calls=0;const counts=new Map<string,number>();return {get calls(){return calls;},fetch:async(url:RequestInfo|URL,init?:RequestInit)=>{
 calls++;assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');assert.equal(init?.cache,'no-store');const u=new URL(String(url));assert.equal(u.origin,'https://api.github.com');const path=u.pathname+u.search,count=(counts.get(path)??0)+1;counts.set(path,count);
 let body:unknown;if(u.pathname==='/graphql'){assert.equal(init?.method,'POST');assert.deepEqual(JSON.parse(String(init?.body)).variables,{number:41});body=f.threads;}else{assert.equal(init?.method,'GET');assert.equal('authorization' in (init?.headers as object),false);const prefix='/repos/tuxfastai-pixel/SpaceCase-';assert.ok(path.startsWith(prefix));const suffix=path.slice(prefix.length);body=suffix==='/pulls/41'?f.pr:suffix==='/pulls/41/reviews?per_page=100'?f.reviews:suffix==='/pulls/41/comments?per_page=100'?f.comments:suffix==='/actions/runs/12/attempts/1/jobs?per_page=100'?f.jobs:suffix==='/actions/runs/12'?{id:12,run_attempt:1,status:'completed',conclusion:'success',event:'pull_request',repository:{full_name:'tuxfastai-pixel/SpaceCase-'}}:suffix===`/contents/.engineering/evidence/${hash}.txt?ref=${head}`?f.file:undefined;assert.notEqual(body,undefined,path);}
 const changed=change?.(path,count);if(changed instanceof Response)return changed;return Response.json(changed??body);
 }};}
test('trusted verification uses live exact-head review, workflow test steps and actual immutable file bytes',async()=>{
 const r=reader(),result=await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,r);assert.equal(result.evidenceVerified,true);assert.deepEqual(result.blockers,[]);assert.equal(result.reviewId,2);assert.equal(result.reviewerGithubId,3);assert.deepEqual(result.artifactDigests,[hash]);assert.deepEqual(result.runIds,[12]);assert.ok(r.calls>5);
});
test('self review, unknown collaborators, bots, old commits and absent explicit packet review cannot pass',async()=>{
 for(const delta of [{user:{id:1,type:'User'}},{user:{id:3,type:'Bot'}},{author_association:'CONTRIBUTOR'},{commit_id:base},{body:'Looks good'},{state:'DISMISSED'}]){
  const f=fixtures();Object.assign(f.reviews[0],delta);assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(f))).evidenceVerified,false);
 }
 const f=fixtures();f.reviews.push({...f.reviews[0],id:5,state:'CHANGES_REQUESTED'});assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(f))).evidenceVerified,false);
});
test('review threads require complete authenticated resolution; missing connection never infers resolution',async()=>{
 const f=fixtures();f.comments=[{id:9}];const unavailable=await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(f));assert.equal(unavailable.evidenceVerified,false);assert.ok(unavailable.blockers.includes('REVIEW_THREADS_UNVERIFIED'));
 assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,{...reader(f),readToken:'synthetic-read-token-only'})).evidenceVerified,true);
 f.threads.data.repository.pullRequest.reviewThreads.nodes[0].isResolved=false;assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,{...reader(f),readToken:'synthetic-read-token-only'})).evidenceVerified,false);
 f.threads.data.repository.pullRequest.reviewThreads.nodes[0].isResolved=true;f.threads.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage=true;assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,{...reader(f),readToken:'synthetic-read-token-only'})).evidenceVerified,false);
});
test('changed proof bytes, incomplete jobs, skipped tests, moved PRs and mutable review changes fail closed',async()=>{
 const f=fixtures();f.file.content=Buffer.from('Different proof bytes').toString('base64');assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(f))).evidenceVerified,false);
 const missing=fixtures();missing.jobs.total_count=2;assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(missing))).evidenceVerified,false);
 const skipped=fixtures();skipped.jobs.jobs[0].steps[0].conclusion='skipped';assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(skipped))).evidenceVerified,false);
 const moved=fixtures();moved.pr.head.sha=base;assert.equal((await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(moved))).evidenceVerified,false);
 const changed=await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(fixtures(),(path,count)=>path.endsWith('/reviews?per_page=100')&&count===2?[]:undefined));assert.ok(changed.blockers.includes('REVIEW_CHANGED_DURING_VERIFICATION'));
});
test('bad digest fails before network; failures/rate limits and incomplete enumerations cannot verify',async()=>{
 const r=reader();assert.equal((await verifyGithubEvidence(packet.packet,'0'.repeat(64),inspection,r)).evidenceVerified,false);assert.equal(r.calls,0);
 const limited=await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(fixtures(),()=>new Response('',{status:429})));assert.deepEqual(limited.blockers,['GITHUB_RATE_LIMITED']);
 const partial=await verifyGithubEvidence(packet.packet,packet.packetDigest,inspection,reader(fixtures(),()=>new Response('{}',{headers:{link:'<https://api.github.com/next>; rel="next"'}})));assert.equal(partial.evidenceVerified,false);
 const failed=await verifyGithubEvidence(packet.packet,packet.packetDigest,{...inspection,validation:'FAILED'},reader());assert.equal(failed.evidenceVerified,false);
});
