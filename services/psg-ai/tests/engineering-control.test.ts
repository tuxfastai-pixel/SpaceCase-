import test from 'node:test';import assert from 'node:assert/strict';import {createHash,generateKeyPairSync,randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {createHandoff} from '../../../packages/engineering-control/contracts';import {signTaskSave} from '../../../packages/engineering-control/transport';import {signTaskControl} from '../../../packages/engineering-control/control-transport';
import {engineeringControlHandler} from '../lib/engineering/control-http';import {saveBlockedTask,listSourceTasks} from '../lib/engineering/ledger';import {migrateEngineering} from '../db/migrate-ledger';
const keys=generateKeyPairSync('ed25519'),actor={personId:randomUUID(),founder:true,sourceRevision:0,sourceOpen:true},env={VERCEL_ENV:'production',PSG_ENGINEERING_LEDGER_ENABLED:'true',PSG_ENGINEERING_SIGNING_PUBLIC_KEY:keys.publicKey.export({format:'pem',type:'spki'}).toString()};
const source=`SC-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
const handoff=createHandoff({reference:source,revision:0,category:'BUG',area:'OTHER'},{problem:'Synthetic task control test.',expected:'List metadata and cancel safely.',observed:'A synthetic blocked task.',steps:['Save a reviewed synthetic brief.'],acceptance:['Cancellation does not start execution.']});
const request={handoff,digest:createHash('sha256').update(JSON.stringify(handoff)).digest('hex'),baseCommit:'f'.repeat(40)};
const req=(attestation:string)=>new Request('https://psg.test/v1/engineering/task-control',{method:'POST',body:JSON.stringify({attestation})});
test('control endpoint denies preview, expired and cross-purpose save tokens before storage',async()=>{
 let touched=false;const pool=()=>{touched=true;throw Error('unexpected');};
 const token=signTaskControl({purpose:'LIST_TICKET_TASKS',sourceReference:source,offset:0},actor,keys.privateKey,1000);
 assert.equal((await engineeringControlHandler({env:()=>({...env,VERCEL_ENV:'preview'}),pool,now:()=>1000})(req(token))).status,503);
 const handle=engineeringControlHandler({env:()=>env,pool,now:()=>1030});assert.equal((await handle(req(token))).status,401);
 assert.equal((await handle(req(signTaskSave({requestId:randomUUID(),request},actor,keys.privateKey,1020)))).status,401);assert.equal(touched,false);
});
test('listing/cancellation are source-bound, metadata-only, paginated and replay-safe',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL},async()=>{
 const owner=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL}),pool=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL,options:'-c role=psg_engineering_runtime'});
 try{
  await migrateEngineering(owner);const saved=await saveBlockedTask(pool,actor,{requestId:randomUUID(),request});
  const handle=engineeringControlHandler({env:()=>env,pool:()=>pool,now:()=>1000});
  const list=await handle(req(signTaskControl({purpose:'LIST_TICKET_TASKS',sourceReference:source,offset:0},actor,keys.privateKey,1000)));assert.equal(list.status,200);const data=await list.json();assert.equal(data.tasks.length,1);assert.equal(JSON.stringify(data).includes(handoff.brief.problem),false);assert.equal(data.executionStarted,false);
  const wrong=signTaskControl({purpose:'CANCEL_TASK',sourceReference:'SC-000000000000',taskId:saved.task.id,revision:0},actor,keys.privateKey,1000);assert.equal((await handle(req(wrong))).status,404);
  const stale=signTaskControl({purpose:'CANCEL_TASK',sourceReference:source,taskId:saved.task.id,revision:9},actor,keys.privateKey,1000);assert.equal((await handle(req(stale))).status,409);
  const cancel=signTaskControl({purpose:'CANCEL_TASK',sourceReference:source,taskId:saved.task.id,revision:0},actor,keys.privateKey,1000);
  const results=await Promise.all([handle(req(cancel)),handle(req(cancel))]);assert.ok(results.every(r=>r.status===200));for(const r of results){const value=await r.json();assert.equal(value.task.state,'CANCELLED');assert.equal(value.executionStarted,false);}
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM engineering.events WHERE task_id=$1 AND kind='CANCELLED'",[saved.task.id])).rows[0].n,1);
  for(let i=0;i<26;i++)await saveBlockedTask(pool,actor,{requestId:randomUUID(),request:{...request,baseCommit:i.toString(16).padStart(40,'0')}});
  const first=await listSourceTasks(pool,actor,{sourceReference:source,offset:0}),second=await listSourceTasks(pool,actor,{sourceReference:source,offset:25});assert.equal(first.tasks.length,25);assert.equal(first.nextOffset,25);assert.equal(second.tasks.length,2);assert.equal(second.nextOffset,null);assert.equal(new Set([...first.tasks,...second.tasks].map(t=>t.id)).size,27);
  await assert.rejects(listSourceTasks(pool,{...actor,founder:false},{sourceReference:source,offset:0}),/FOUNDER_REQUIRED/);
 }finally{await owner.end();await pool.end();}
});
test('audit history stays source-bound and survives brief expiry without exposing actors or saved content',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL},async()=>{
 const owner=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL}),pool=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL,options:'-c role=psg_engineering_runtime'});
 try{
  await migrateEngineering(owner);const reference=`SC-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
  const packet={...handoff,source:{...handoff.source,reference}},submission={handoff:packet,digest:createHash('sha256').update(JSON.stringify(packet)).digest('hex'),baseCommit:'c'.repeat(40)};
  const saved=await saveBlockedTask(pool,actor,{requestId:randomUUID(),request:submission});const taskId=saved.task.id;
  const handle=engineeringControlHandler({env:()=>env,pool:()=>pool,now:()=>1000});
  const history=(sourceReference=reference,id=taskId)=>handle(req(signTaskControl({purpose:'READ_TASK_HISTORY',sourceReference,taskId:id},actor,keys.privateKey,1000)));
  assert.equal((await history('SC-000000000000')).status,404);assert.equal((await history(reference,randomUUID())).status,404);
  const first=await history();assert.equal(first.status,200);assert.deepEqual((await first.json()).events.map((e:{kind:string})=>e.kind),['CREATED']);
  const cancellation=signTaskControl({purpose:'CANCEL_TASK',sourceReference:reference,taskId,revision:0},actor,keys.privateKey,1000);assert.equal((await handle(req(cancellation))).status,200);
  await owner.query("UPDATE engineering.tasks SET brief_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[taskId]);await pool.query('SELECT engineering.expire_briefs(500)');
  const result=await (await history()).json();assert.deepEqual(result.events.map((e:{kind:string})=>e.kind),['BRIEF_EXPIRED','CANCELLED','CREATED']);assert.deepEqual(result.events.map((e:{revision:number})=>e.revision),[2,1,0]);assert.equal(result.truncated,false);assert.equal(result.executionStarted,false);
  assert.equal(JSON.stringify(result).includes(actor.personId),false);assert.equal(JSON.stringify(result).includes(handoff.brief.problem),false);assert.equal(JSON.stringify(result).includes('actor'),false);
  assert.deepEqual(await (await history()).json(),result);assert.equal((await owner.query('SELECT handoff FROM engineering.tasks WHERE id=$1',[taskId])).rows[0].handoff,null);
 }finally{await owner.end();await pool.end();}
});
