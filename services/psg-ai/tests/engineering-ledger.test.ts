import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {Pool} from 'pg';
import {createHandoff} from '../../../packages/engineering-control/contracts';
import {saveBlockedTask,cancelBlockedTask} from '../lib/engineering/ledger';
import {migrateEngineering} from '../db/migrate-ledger';
const source={reference:`SC-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`,revision:2,category:'BUG' as const,area:'OTHER' as const};
const handoff=createHandoff(source,{problem:'Synthetic report date entry does not advance.',expected:'Move focus to the month.',observed:'Focus stays in the year.',steps:['Enter four year digits.'],acceptance:['Focus moves after four digits.']});
const request={handoff,digest:createHash('sha256').update(JSON.stringify(handoff)).digest('hex'),baseCommit:'a'.repeat(40)};
const authority={founder:true,personId:randomUUID(),sourceRevision:2,sourceOpen:true};
test('ledger rejects missing founder authority and invalid preflight before connecting',async()=>{
 let touched=false;const trap={connect:async()=>{touched=true;throw new Error('unexpected storage');}} as unknown as Pool;
 await assert.rejects(saveBlockedTask(trap,{...authority,founder:false},{requestId:randomUUID(),request}),/FOUNDER_REQUIRED/);
 await assert.rejects(saveBlockedTask(trap,{...authority,sourceRevision:3},{requestId:randomUUID(),request}),/TICKET_CHANGED/);
 await assert.rejects(saveBlockedTask(trap,{...authority,sourceOpen:false},{requestId:randomUUID(),request}),/CASE_CLOSED/);
 await assert.rejects(saveBlockedTask(trap,authority,{requestId:randomUUID(),request:{...request,digest:'f'.repeat(64)}}),/HANDOFF_DIGEST_MISMATCH/);
 await assert.rejects(cancelBlockedTask(trap,{...authority,founder:false},{taskId:randomUUID(),revision:0}),/FOUNDER_REQUIRED/);
 assert.equal(touched,false);
});

test('dedicated Postgres ledger persists across connections, deduplicates concurrent retries and audits cancellation',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL},async()=>{
 const connectionString=process.env.PSG_ENGINEERING_TEST_DATABASE_URL;
 const owner=new Pool({connectionString,max:2});
 const runtime=new Pool({connectionString,options:'-c role=psg_engineering_runtime',max:8});
 const input={requestId:randomUUID(),request};
 try{
  await migrateEngineering(owner);await migrateEngineering(owner);
  const results=await Promise.all(Array.from({length:6},()=>saveBlockedTask(runtime,authority,input)));
  const task=results[0].task;assert.equal(task.state,'BLOCKED');assert.ok(results.every(r=>r.task.id===task.id&&!r.executionStarted));
  const reopened=new Pool({connectionString,options:'-c role=psg_engineering_runtime'});
  try{assert.equal((await saveBlockedTask(reopened,authority,input)).task.id,task.id);}finally{await reopened.end();}
  // Different request IDs for the same reviewed work also converge, without overwriting the brief.
  const duplicate=await Promise.all(Array.from({length:4},()=>saveBlockedTask(runtime,authority,{...input,requestId:randomUUID()})));
  assert.ok(duplicate.every(r=>r.task.id===task.id));
  await assert.rejects(saveBlockedTask(runtime,authority,{...input,request:{...request,baseCommit:'b'.repeat(40)}}),/REQUEST_REUSED/);
  const stored=await owner.query('SELECT handoff FROM engineering.tasks WHERE id=$1',[task.id]);assert.deepEqual(stored.rows[0].handoff,handoff);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM engineering.events WHERE task_id=$1',[task.id])).rows[0].n,1);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM engineering.requests WHERE task_id=$1',[task.id])).rows[0].n,5);
  await assert.rejects(cancelBlockedTask(runtime,authority,{taskId:task.id,revision:9}),/TASK_CHANGED/);
  const cancelled=await Promise.allSettled(Array.from({length:2},()=>cancelBlockedTask(runtime,authority,{taskId:task.id,revision:0})));
  assert.equal(cancelled.filter(r=>r.status==='fulfilled').length,1);assert.equal(cancelled.filter(r=>r.status==='rejected').length,1);
  const retry=await saveBlockedTask(runtime,authority,input);assert.equal(retry.task.state,'CANCELLED');assert.equal(retry.task.revision,1);
  const audit=await owner.query('SELECT kind,revision FROM engineering.events WHERE task_id=$1 ORDER BY revision',[task.id]);assert.deepEqual(audit.rows,[{kind:'CREATED',revision:0},{kind:'CANCELLED',revision:1}]);
  await assert.rejects(runtime.query('UPDATE engineering.tasks SET handoff=$1 WHERE id=$2',[JSON.stringify(handoff),task.id]),/permission denied/);
  await assert.rejects(runtime.query('DELETE FROM engineering.events WHERE task_id=$1',[task.id]),/permission denied/);
  await assert.rejects(runtime.query("UPDATE engineering.events SET kind='CREATED' WHERE task_id=$1",[task.id]),/permission denied/);
  await assert.rejects(runtime.query("UPDATE engineering.tasks SET state='RUNNING' WHERE id=$1",[task.id]),/check constraint/);
 }finally{await runtime.end();await owner.end();}
});
