import test from 'node:test';import assert from 'node:assert/strict';
import {inspectRepository} from '../../packages/engineering-control/repository-reader';
const a='a'.repeat(40),b='b'.repeat(40),merge='c'.repeat(40),input={pullRequest:36,expectedHeadCommit:a},repo='tuxfastai-pixel/SpaceCase-';
const pr={number:36,state:'open',merged:false,draft:false,head:{sha:a,ref:'feature/check'},base:{sha:b,ref:'main',repo:{full_name:repo}},body:'private narrative is ignored'};
const run={id:100,event:'push',head_sha:a,path:'.github/workflows/validate.yml',run_number:10,run_attempt:1,status:'completed',conclusion:'success',repository:{full_name:repo},pull_requests:[]};
const prRun={...run,id:101,event:'pull_request',run_number:11,head_sha:merge,pull_requests:[{number:36,head:{sha:a},base:{sha:b}}]};
function fixture(pushes:unknown[]=[run],pulls:unknown[]=[prRun],patch:Record<string,unknown>={},total?:number){return {now:()=>new Date('2026-10-23T10:00:00Z'),fetch:async(url:RequestInfo|URL,options?:RequestInit)=>{assert.ok(String(url).startsWith('https://api.github.com/repos/'+repo+'/'));assert.equal(options?.method,'GET');assert.equal(options?.redirect,'error');assert.equal(options?.credentials,'omit');assert.equal(Object.keys(options?.headers??{}).includes('authorization'),false);return Response.json(String(url).includes('event=push')?{total_count:pushes.length,workflow_runs:pushes}:String(url).includes('event=pull_request')?{total_count:total??pulls.length,workflow_runs:pulls}:{...pr,...patch});}};}
test('repository snapshot correlates current PR head/base including merge-SHA runs and never grants approval',async()=>{
 const result=await inspectRepository(input,fixture());assert.equal(result.validation,'PASSED');assert.deepEqual(result.blockers,[]);assert.equal(result.releasePermission,false);assert.equal(result.codeReviewVerified,false);assert.equal(result.taskAssociationVerified,false);assert.equal(result.executionStarted,false);assert.equal(JSON.stringify(result).includes(pr.body),false);
 assert.ok((await inspectRepository({...input,expectedHeadCommit:b},fixture())).blockers.includes('HEAD_CHANGED'));
 assert.equal((await inspectRepository(input,fixture([]))).validation,'PASSED');
});
test('latest attempts and PR validation fail closed on pending, failed, skipped or missing runs',async()=>{
 for(const conclusion of ['failure','skipped','cancelled',null])assert.equal((await inspectRepository(input,fixture([run],[{...prRun,conclusion}]))).validation,'FAILED');
 assert.equal((await inspectRepository(input,fixture([run],[prRun,{...prRun,id:102,run_attempt:2,status:'queued',conclusion:null}]))).validation,'PENDING');
 assert.equal((await inspectRepository(input,fixture([{...run,conclusion:'failure'}]))).validation,'FAILED');
 assert.equal((await inspectRepository(input,fixture([run],[]))).validation,'MISSING');assert.equal((await inspectRepository(input,fixture([run],[prRun],{},101))).validation,'INCOMPLETE');
 assert.deepEqual((await inspectRepository(input,fixture([run],[prRun],{state:'closed',merged:true,draft:true,base:{...pr.base,ref:'other'}}))).blockers,['PR_NOT_OPEN','DRAFT_PR','BASE_BRANCH_NOT_MAIN']);
});
test('other PRs, old heads and old bases cannot substitute for current PR validation',async()=>{
 for(const p of [{number:35,head:{sha:a},base:{sha:b}},{number:36,head:{sha:b},base:{sha:b}},{number:36,head:{sha:a},base:{sha:a}}])assert.equal((await inspectRepository(input,fixture([run],[{...prRun,pull_requests:[p]}]))).validation,'MISSING');
 assert.equal((await inspectRepository(input,fixture([run],[{...prRun,pull_requests:[]}]))).validation,'MISSING');
});
test('changed, forged, redirected, oversized, unavailable and rate-limited responses cannot become verified checks',async()=>{
 for(const pushes of [[{...run,head_sha:b}],[{...run,path:'.github/workflows/fake.yml'}],[{...run,repository:{full_name:'other/repo'}}]])await assert.rejects(inspectRepository(input,fixture(pushes)),/REPOSITORY_UNAVAILABLE/);
 let prReads=0;const normal=fixture();await assert.rejects(inspectRepository(input,{now:normal.now,fetch:async(url,options)=>String(url).includes('/pulls/')?Response.json({...pr,head:{...pr.head,sha:++prReads===2?b:a}}):normal.fetch(url,options)}),/REPOSITORY_CHANGED/);
 for(const [status,error]of [[403,'UNAVAILABLE'],[429,'RATE_LIMITED'],[404,'REFERENCE_UNAVAILABLE'],[302,'UNAVAILABLE'],[500,'UNAVAILABLE']] as const)await assert.rejects(inspectRepository(input,{now:()=>new Date(),fetch:async()=>new Response('',{status})}),new RegExp(error));
 await assert.rejects(inspectRepository(input,{now:()=>new Date(),fetch:async()=>new Response('',{status:403,headers:{'x-ratelimit-remaining':'0'}})}),/REPOSITORY_RATE_LIMITED/);
 await assert.rejects(inspectRepository(input,{now:()=>new Date(),fetch:async()=>new Response('x'.repeat(1048577))}),/REPOSITORY_UNAVAILABLE/);
});
