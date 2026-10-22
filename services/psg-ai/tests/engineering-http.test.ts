import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {createHandoff} from '../../../packages/engineering-control/contracts';
import {signTaskSave} from '../../../packages/engineering-control/transport';
import {engineeringTasksHandler} from '../lib/engineering/http';import {migrateEngineering} from '../db/migrate-ledger';
const keys=generateKeyPairSync('ed25519'),publicPem=keys.publicKey.export({format:'pem',type:'spki'}).toString();
const handoff=createHandoff({reference:`SC-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`,revision:0,category:'BUG',area:'OTHER'},{problem:'Synthetic report focus does not advance.',expected:'Advance after the year.',observed:'Focus remains in year.',steps:['Enter four year digits.'],acceptance:['Focus moves to month.']});
const input={requestId:randomUUID(),request:{handoff,digest:createHash('sha256').update(JSON.stringify(handoff)).digest('hex'),baseCommit:'a'.repeat(40)}};
const actor={personId:randomUUID(),founder:true,sourceRevision:0,sourceOpen:true};
const env={VERCEL_ENV:'production',PSG_ENGINEERING_LEDGER_ENABLED:'true',PSG_ENGINEERING_SIGNING_PUBLIC_KEY:publicPem};
const request=(body:unknown)=>new Request('https://psg.test/v1/engineering/tasks',{method:'POST',body:JSON.stringify(body)});
test('engineering endpoint denies disabled, preview, forged and expired submissions before storage',async()=>{
 let opened=false;const pool=()=>{opened=true;throw new Error('storage must not open');};
 for(const config of [{},{...env,VERCEL_ENV:'preview'},{...env,PSG_ENGINEERING_LEDGER_ENABLED:'false'}])assert.equal((await engineeringTasksHandler({env:()=>config,pool,now:()=>1000})(request({}))).status,503);
 const handle=engineeringTasksHandler({env:()=>env,pool,now:()=>1000});
 for(const body of [{attestation:'forged',founder:true},{attestation:'forged'},{attestation:signTaskSave(input,actor,keys.privateKey,900)},{attestation:signTaskSave(input,actor,generateKeyPairSync('ed25519').privateKey,1000)}])assert.equal((await handle(request(body))).status,401);
 assert.equal((await handle(new Request('https://psg.test/v1/engineering/tasks',{method:'POST',body:'x'.repeat(90001)}))).status,413);
 assert.equal(opened,false);
});
test('signed HTTP submission persists a blocked task and retry never executes it',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL},async()=>{
 const owner=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL}),runtime=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL,options:'-c role=psg_engineering_runtime'});
 try{
  await migrateEngineering(owner);
  const handle=engineeringTasksHandler({env:()=>env,pool:()=>runtime,now:()=>1000});
  const envelope={attestation:signTaskSave(input,actor,keys.privateKey,1000)};
  const first=await handle(request(envelope));assert.equal(first.status,200);const result=await first.json();assert.equal(result.executionStarted,false);assert.equal(result.task.state,'BLOCKED');assert.equal(typeof result.task.createdAt,'string');assert.equal(result.task.baseCommit,input.request.baseCommit);
  assert.deepEqual(await (await handle(request(envelope))).json(),result);
  const conflict={...input,request:{...input.request,baseCommit:'b'.repeat(40)}};
  assert.equal((await handle(request({attestation:signTaskSave(conflict,actor,keys.privateKey,1000)}))).status,409);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM engineering.events WHERE task_id=$1',[result.task.id])).rows[0].n,1);
 }finally{await runtime.end();await owner.end();}
});

test('product-to-service save rechecks source, transfers no raw narrative/session, and binds the response',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL||!process.env.DATABASE_URL},async()=>{
 const {createTicket}=await import('../../../domains/support/service');
 const {saveEngineeringTask}=await import('../../../platform/support/engineeringAdapter');
 const productPool=new Pool({connectionString:process.env.DATABASE_URL}),ledgerOwner=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL}),runtime=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL,options:'-c role=psg_engineering_runtime'});
 const school=randomUUID(),reporter=randomUUID(),founder={personId:randomUUID(),founder:true,schools:[]};
 try{
  await migrateEngineering(ledgerOwner);
  const ticket=await createTicket(productPool,{personId:reporter,founder:false,schools:[{id:school,displayName:'Private synthetic school'}]},{schoolId:school,requestId:randomUUID(),category:'BUG',impact:'DEGRADED',area:'OTHER',title:'Private synthetic title',description:'Private synthetic narrative and school contact must stay here.'});
  const args={ticketId:ticket.id,revision:0,requestId:randomUUID(),baseCommit:'c'.repeat(40),privacyReviewed:true as const,consentToStore:true as const,brief:handoff.brief};
  const handle=engineeringTasksHandler({env:()=>env,pool:()=>runtime,now:()=>1000});let calls=0;
  const deps={env:()=>({VERCEL_ENV:'production',SPACECASE_ENGINEERING_LEDGER_ENABLED:'true',PSG_ENGINEERING_BASE_URL:'https://psg.test/',SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY:keys.privateKey.export({format:'pem',type:'pkcs8'}).toString()}),now:()=>1000,fetch:(async(url,options)=>{
   calls++;assert.equal(String(url),'https://psg.test/v1/engineering/tasks');assert.equal(options?.redirect,'error');assert.equal(new Headers(options?.headers).has('authorization'),false);assert.equal(new Headers(options?.headers).has('cookie'),false);
   const envelope=JSON.parse(options?.body as string);const claims=JSON.parse(Buffer.from(envelope.attestation.split('.')[0],'base64url').toString());
   for(const value of [school,reporter,ticket.id,'Private synthetic'])assert.equal(JSON.stringify(claims).includes(value),false);
   return handle(new Request(url,options));
  }) as typeof fetch};
  const first=await saveEngineeringTask(productPool,founder,args,deps);assert.equal(first.task.state,'BLOCKED');assert.equal(first.executionStarted,false);
  assert.deepEqual(await saveEngineeringTask(productPool,founder,args,deps),first);
  await assert.rejects(saveEngineeringTask(productPool,founder,{...args,baseCommit:'d'.repeat(40)},deps),/ENGINEERING_REQUEST_CONFLICT/);
  const mismatch={...deps,fetch:(async()=>Response.json({...first,task:{...first.task,handoffDigest:'0'.repeat(64)}})) as typeof fetch};
  await assert.rejects(saveEngineeringTask(productPool,founder,args,mismatch),/ENGINEERING_LEDGER_UNAVAILABLE/);
  const before=calls;
  await productPool.query('UPDATE support.tickets SET revision=revision+1 WHERE id=$1',[ticket.id]);
  await assert.rejects(saveEngineeringTask(productPool,founder,args,deps),/TICKET_CHANGED/);
  await productPool.query("UPDATE support.tickets SET status='CLOSED' WHERE id=$1",[ticket.id]);
  await assert.rejects(saveEngineeringTask(productPool,founder,{...args,revision:1},deps),/CASE_CLOSED/);assert.equal(calls,before);
 }finally{
  await productPool.query('DELETE FROM support.events WHERE ticket_id IN(SELECT id FROM support.tickets WHERE school_id=$1)',[school]);await productPool.query('DELETE FROM support.tickets WHERE school_id=$1',[school]);await productPool.query('DELETE FROM audit.product_audit_events WHERE school_id=$1',[school]);
  await productPool.end();await ledgerOwner.end();await runtime.end();
 }
});
