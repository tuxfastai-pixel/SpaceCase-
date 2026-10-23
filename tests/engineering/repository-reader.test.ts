import test from 'node:test';import assert from 'node:assert/strict';
import {inspectRepository} from '../../packages/engineering-control/repository-reader';
const a='a'.repeat(40),b='b'.repeat(40),input={pullRequest:36,expectedHeadCommit:a},repo='tuxfastai-pixel/SpaceCase-';
const pr={number:36,state:'open',merged:false,draft:false,head:{sha:a},base:{sha:b,ref:'main',repo:{full_name:repo}},body:'private narrative is ignored'};
const run={id:100,event:'push',head_sha:a,path:'.github/workflows/validate.yml',run_number:10,run_attempt:1,status:'completed',conclusion:'success',repository:{full_name:repo}};
function fixture(runs:unknown[]=[run],patch:Record<string,unknown>={},total=runs.length){let calls=0;const deps={now:()=>new Date('2026-10-23T10:00:00Z'),fetch:async(url:RequestInfo|URL,options?:RequestInit)=>{calls++;assert.ok(String(url).startsWith('https://api.github.com/repos/'+repo+'/'));assert.equal(options?.method,'GET');assert.equal(options?.redirect,'error');assert.equal(options?.credentials,'omit');assert.equal(Object.keys(options?.headers??{}).includes('authorization'),false);return Response.json(calls===2?{total_count:total,workflow_runs:runs}:{...pr,...patch});}};return deps;}
test('repository snapshot binds exact head and trusted workflow, returns metadata and never approval',async()=>{
 const result=await inspectRepository(input,fixture());assert.equal(result.validation,'PASSED');assert.deepEqual(result.blockers,[]);assert.equal(result.releasePermission,false);assert.equal(result.codeReviewVerified,false);assert.equal(result.taskAssociationVerified,false);assert.equal(result.executionStarted,false);assert.equal(JSON.stringify(result).includes(pr.body),false);
 assert.ok((await inspectRepository({...input,expectedHeadCommit:b},fixture())).blockers.includes('HEAD_CHANGED'));
});
test('latest attempts and each event fail closed on pending, failed, skipped or missing validation',async()=>{
 for(const conclusion of ['failure','skipped','cancelled',null])assert.equal((await inspectRepository(input,fixture([{...run,conclusion}]))).validation,'FAILED');
 assert.equal((await inspectRepository(input,fixture([run,{...run,id:101,run_attempt:2,status:'queued',conclusion:null}]))).validation,'PENDING');
 assert.equal((await inspectRepository(input,fixture([run,{...run,id:102,event:'pull_request',conclusion:'failure'}]))).validation,'FAILED');
 assert.equal((await inspectRepository(input,fixture([]))).validation,'MISSING');assert.equal((await inspectRepository(input,fixture([run],{},101))).validation,'INCOMPLETE');
 assert.deepEqual((await inspectRepository(input,fixture([run],{state:'closed',merged:true,draft:true,base:{...pr.base,ref:'other'}}))).blockers,['PR_NOT_OPEN','DRAFT_PR','BASE_BRANCH_NOT_MAIN']);
});
test('changed, forged, redirected, oversized, unavailable and rate-limited responses cannot become verified checks',async()=>{
 for(const runs of [[{...run,head_sha:b}],[{...run,path:'.github/workflows/fake.yml'}],[{...run,repository:{full_name:'other/repo'}}]])await assert.rejects(inspectRepository(input,fixture(runs)),/REPOSITORY_UNAVAILABLE/);
 let calls=0;await assert.rejects(inspectRepository(input,{now:()=>new Date(),fetch:async()=>Response.json(++calls===2?{total_count:1,workflow_runs:[run]}:{...pr,head:{sha:calls===3?b:a}})}),/REPOSITORY_CHANGED/);
 for(const [status,error]of [[403,'RATE_LIMITED'],[429,'RATE_LIMITED'],[404,'REFERENCE_UNAVAILABLE'],[302,'UNAVAILABLE'],[500,'UNAVAILABLE']] as const)await assert.rejects(inspectRepository(input,{now:()=>new Date(),fetch:async()=>new Response('',{status})}),new RegExp(error));
 await assert.rejects(inspectRepository(input,{now:()=>new Date(),fetch:async()=>new Response('x'.repeat(1048577))}),/REPOSITORY_UNAVAILABLE/);
});
