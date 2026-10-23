import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {founderHandler} from '../../platform/support/http';import {inspectFounderRepository} from '../../platform/support/repositoryInspection';import {RepositoryReadError} from '../../packages/engineering-control/repository-reader';
const input={pullRequest:36,expectedHeadCommit:'a'.repeat(40)},actor={personId:randomUUID(),founder:false,schools:[]};
test('repository inspection checks founder authority and strict input before external reads',async()=>{
 let reads=0;const reader=async()=>{reads++;throw new RepositoryReadError('REPOSITORY_RATE_LIMITED');};await assert.rejects(inspectFounderRepository(actor,input,reader),/FOUNDER_REQUIRED/);assert.equal(reads,0);
 await assert.rejects(inspectFounderRepository({...actor,founder:true},{...input,repository:'other/repo'},reader));assert.equal(reads,0);
 await assert.rejects(inspectFounderRepository({...actor,founder:true},input,reader),e=>e instanceof Error&&'status'in e&&e.status===429);assert.equal(reads,1);
});
test('founder inspection endpoint denies cross-origin requests and privilege injection before any pooling',async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL='https://spacecase.test';let pooled=false;let founder=false;
 const handle=founderHandler({context:async()=>({...actor,founder}),pool:()=>{pooled=true;throw Error('unexpected');},peos:async()=>{throw Error('unexpected');}});
 const body={action:'INSPECT_ENGINEERING_PR',...input},request=(payload:unknown=body,origin='https://spacecase.test')=>new Request('https://spacecase.test/api/v1/founder',{method:'POST',headers:{origin,authorization:'Bearer synthetic'},body:JSON.stringify(payload)});
 try{assert.equal((await handle(request())).status,403);founder=true;assert.equal((await handle(request(body,'https://wrong.test'))).status,403);assert.equal((await handle(request({...body,founder:true}))).status,400);assert.equal((await handle(request({...body,pullRequest:-1}))).status,400);assert.equal(pooled,false);}
 finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
