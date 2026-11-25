import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {parentHomeState} from '../../platform/family/home';
import {familyBillingDirectory} from '../../platform/family/billingContracts';
import {accountKeyInput,browserAccountKey,selectAccount} from '../../platform/family/accountNavigation';
import {acknowledgeHomeNotice,homeNoticeSeen,HomeNoticeChanged} from '../../platform/family/homeNotice';
const id='123e4567-e89b-42d3-a456-426614174000';
function ready(plan=true){return parentHomeState({connections:null,directory:familyBillingDirectory.parse({contractVersion:'family-billing-v1',scopes:[{grantId:id,schoolId:id,learnerPersonId:id,schoolName:'Example school',learnerReference:'DEMO-1',givenName:'Example',familyName:'Learner',actions:plan?['family.finance.read','family.finance.plan.accept']:['family.finance.read'],expiresAt:'2099-12-01T10:00:00Z'}],truncated:false}),plansEnabled:true,incomplete:false});}
test('account navigation matches the server projection and never falls back to a different learner for an unavailable link',async()=>{
 const key=await browserAccountKey(id);assert.equal(key,createHash('sha256').update(accountKeyInput(id)).digest('hex'));assert.equal(ready().learners[0].accountKey,key);
 assert.equal(await selectAccount([id],'',key),id);assert.equal(await selectAccount([id],'','a'.repeat(64)),'');assert.equal(await selectAccount([id],'','invalid'),'');assert.equal(await selectAccount([id],'',null),id);assert.equal(await selectAccount([],id,key),'');
});
test('ready notice changes with access but not balances or acknowledgement',()=>{
 assert.equal(ready().readyNoticeKey,ready().readyNoticeKey);assert.notEqual(ready().readyNoticeKey,ready(false).readyNoticeKey);assert.equal(ready().readyAcknowledged,false);
 const absent=parentHomeState({connections:null,directory:null,plansEnabled:true,incomplete:false});assert.equal(absent.readyNoticeKey,null);
});
test('acknowledgement rejects changed access and body-supplied identities before writing',async()=>{
 const pool={query:async()=>{throw Error('must not write');}} as unknown as Pool;
 await assert.rejects(acknowledgeHomeNotice(pool,'owner',{noticeKey:ready().readyNoticeKey},async()=>ready(false)),HomeNoticeChanged);
 await assert.rejects(acknowledgeHomeNotice(pool,'owner',{noticeKey:ready().readyNoticeKey,owner:'other'},async()=>ready()));
});
test('ready acknowledgement persists across connections, remains owner scoped and idempotent',{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),owner=randomUUID(),other=randomUUID(),home=ready(),key=home.readyNoticeKey!;
 try{assert.equal(await homeNoticeSeen(pool,owner,key),false);await acknowledgeHomeNotice(pool,owner,{noticeKey:key},async()=>home);await acknowledgeHomeNotice(pool,owner,{noticeKey:key},async()=>home);const fresh=new Pool({connectionString:process.env.DATABASE_URL});try{assert.equal(await homeNoticeSeen(fresh,owner,key),true);assert.equal(await homeNoticeSeen(fresh,other,key),false);}finally{await fresh.end();}const client=await pool.connect();try{await client.query('SET ROLE spacecase_runtime');assert.equal(await homeNoticeSeen(client as unknown as Pool,owner,key),true);await assert.rejects(client.query('UPDATE family_intake.home_acknowledgements SET acknowledged_at=now() WHERE owner_person_id=$1',[owner]),/permission denied/);await assert.rejects(client.query('DELETE FROM family_intake.home_acknowledgements WHERE owner_person_id=$1',[owner]),/permission denied/);}finally{await client.query('RESET ROLE');client.release();}assert.equal((await pool.query('SELECT count(*) FROM family_intake.home_acknowledgements WHERE owner_person_id=$1',[owner])).rows[0].count,'1');
 }finally{await pool.query('DELETE FROM family_intake.home_acknowledgements WHERE owner_person_id=$1',[owner]);await pool.end();}
});
