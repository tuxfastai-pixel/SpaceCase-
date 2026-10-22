import test from 'node:test';import assert from 'node:assert/strict';import {Pool} from 'pg';import {randomUUID,createHash} from 'node:crypto';
import {migrateEngineering} from '../db/migrate-ledger';import {saveBlockedTask} from '../lib/engineering/ledger';import {createHandoff} from '../../../packages/engineering-control/contracts';import {retentionHandler} from '../lib/engineering/retention';
test('retention endpoint denies missing or preview credentials before touching storage',async()=>{
 let touched=false;const pool=()=>{touched=true;throw Error('unexpected');};
 const env={VERCEL_ENV:'production',PSG_ENGINEERING_LEDGER_ENABLED:'true',CRON_SECRET:'s'.repeat(40)};
 const req=new Request('https://psg.test/api/cron/engineering-retention');
 assert.equal((await retentionHandler({env:()=>env,pool})(req)).status,401);
 assert.equal((await retentionHandler({env:()=>({...env,VERCEL_ENV:'preview'}),pool})(req)).status,503);assert.equal(touched,false);
});
test('expiry clears only due content, keeps tombstones/idempotency, and cannot be bypassed by runtime grants',{skip:!process.env.PSG_ENGINEERING_TEST_DATABASE_URL},async()=>{
 const owner=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL}),runtime=new Pool({connectionString:process.env.PSG_ENGINEERING_TEST_DATABASE_URL,options:'-c role=psg_engineering_runtime'});
 const actor={personId:randomUUID(),founder:true,sourceRevision:0,sourceOpen:true};
 const handoff=createHandoff({reference:`SC-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`,revision:0,category:'BUG',area:'OTHER'},{problem:'Synthetic retention reproduction case.',expected:'Expire only reviewed content.',observed:'A synthetic retained brief.',steps:['Save a synthetic task.'],acceptance:['Only expired content is removed.']});
 const input={requestId:randomUUID(),request:{handoff,digest:createHash('sha256').update(JSON.stringify(handoff)).digest('hex'),baseCommit:'e'.repeat(40)}};
 try{
  await migrateEngineering(owner);const created=await saveBlockedTask(runtime,actor,input);assert.equal(created.task.briefAvailable,true);
  assert.equal((await runtime.query('SELECT engineering.expire_briefs(500) AS n')).rows[0].n,0);
  await owner.query("UPDATE engineering.tasks SET brief_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[created.task.id]);
  assert.equal((await saveBlockedTask(runtime,actor,input)).task.briefAvailable,false);
  await Promise.all([runtime.query('SELECT engineering.expire_briefs(500)'),runtime.query('SELECT engineering.expire_briefs(500)')]);
  const stored=(await owner.query('SELECT handoff,brief_removed_at,revision FROM engineering.tasks WHERE id=$1',[created.task.id])).rows[0];assert.equal(stored.handoff,null);assert.ok(stored.brief_removed_at);assert.equal(stored.revision,1);
  const retry=await saveBlockedTask(runtime,actor,input);assert.equal(retry.task.id,created.task.id);assert.equal(retry.task.briefAvailable,false);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM engineering.events WHERE task_id=$1 AND kind='BRIEF_EXPIRED'",[created.task.id])).rows[0].n,1);
  await assert.rejects(runtime.query('UPDATE engineering.tasks SET handoff=$1 WHERE id=$2',[JSON.stringify(handoff),created.task.id]),/permission denied/);
  await assert.rejects(runtime.query("UPDATE engineering.tasks SET brief_expires_at=clock_timestamp()+interval '100 days' WHERE id=$1",[created.task.id]),/permission denied/);
 }finally{await owner.end();await runtime.end();}
});
