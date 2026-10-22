import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,randomUUID} from 'node:crypto';import type {Pool} from 'pg';
import {controlEngineeringTask} from '../../platform/support/engineeringControl';
import {verifyTaskControl} from '../../packages/engineering-control/control-transport';
test('product controls require fresh founder authority and bind closed-ticket cancellation and list acknowledgements',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');const actor={personId:randomUUID(),founder:true,schools:[]};const ticketId=randomUUID(),taskId=randomUUID();let queries=0,calls=0;
 const pool={query:async(sql:string)=>{queries++;assert.equal(sql,'SELECT reference FROM support.tickets WHERE id=$1');return {rowCount:1,rows:[{reference:'SC-ABCDEF012345'}]};}} as unknown as Pool;
 const task={id:taskId,project:'SPACECASE',sourceReference:'SC-ABCDEF012345',sourceRevision:0,handoffDigest:'a'.repeat(64),baseCommit:'b'.repeat(40),state:'CANCELLED',revision:1,createdAt:new Date(0).toISOString(),cancelledAt:new Date(1000).toISOString(),briefExpiresAt:new Date(604800000).toISOString(),briefAvailable:true};
 const env=()=>({VERCEL_ENV:'production',SPACECASE_ENGINEERING_LEDGER_ENABLED:'true',PSG_ENGINEERING_BASE_URL:'https://engineering.test/',SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}).toString()});
 let response:unknown={task,executionStarted:false};
 const deps={env,now:()=>1000,fetch:async(url:URL|RequestInfo,init?:RequestInit)=>{calls++;assert.equal(String(url),'https://engineering.test/v1/engineering/task-control');assert.deepEqual(init?.headers,{'content-type':'application/json'});assert.equal(init?.redirect,'error');const claims=verifyTaskControl(JSON.parse(String(init?.body)).attestation,publicKey,1000);assert.equal(claims.actorPersonId,actor.personId);assert.equal(claims.input.sourceReference,task.sourceReference);return Response.json(response);}};
 const input={operation:'CANCEL' as const,ticketId,taskId,revision:0};
 await assert.rejects(controlEngineeringTask(pool,{...actor,founder:false},input,deps),/FOUNDER_REQUIRED/);assert.equal(queries,0);assert.equal(calls,0);
 assert.deepEqual(await controlEngineeringTask(pool,actor,input,deps),response);
 response={task:{...task,id:randomUUID()},executionStarted:false};await assert.rejects(controlEngineeringTask(pool,actor,input,deps),/ENGINEERING_LEDGER_UNAVAILABLE/);
 response={tasks:[{...task,sourceReference:'SC-000000000000'}],nextOffset:null,executionStarted:false};await assert.rejects(controlEngineeringTask(pool,actor,{operation:'LIST',ticketId,offset:0},deps),/ENGINEERING_LEDGER_UNAVAILABLE/);
 response={tasks:[task],nextOffset:null,executionStarted:false};assert.deepEqual(await controlEngineeringTask(pool,actor,{operation:'LIST',ticketId,offset:0},deps),response);
});
