import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';import {initializeFinance,type FinanceAuthority} from '../../domains/school-finance/workspaceService';import {writeActivityRegister} from '../../domains/school-activities/registerService';import {registerCommand} from '../../domains/school-activities/registerContracts';import {offerActivity} from '../../domains/school-activities/participationService';import {conversation,readParentInbox,readStaffConversations} from '../../domains/school-communications/service';import type {ConversationAuthority} from '../../domains/school-communications/contracts';import {samplePolicy} from '../school-activities/fixtures';
test('Finance notices/private conversations preserve school/parent boundaries, current authority, unread history, retries and no money',{timeout:60000},async t=>{
 if(!process.env.DATABASE_URL){t.skip('Requires isolated PostgreSQL');return;}
 const old=process.env.SPACECASE_PARENT_INBOX_ENABLED;process.env.SPACECASE_PARENT_INBOX_ENABLED='true';
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:6}),schoolId=randomUUID(),principal=randomUUID(),officer=randomUUID(),parent=randomUUID(),learner=randomUUID(),grantId=randomUUID();let accountId='';
 const authority=(personId:string):FinanceAuthority=>async school=>({schoolId:school,personId});const scope=(actorPersonId=officer)=>({schoolId,accountId,actorPersonId});const write=(v:Record<string,unknown>,actor=officer)=>writeActivityRegister(pool,scope(actor),registerCommand.parse({schoolId,accountId,requestId:randomUUID(),...v}),authority(actor));
 const p=async():Promise<ConversationAuthority>=>({allowed:true,contractVersion:'finance-conversations-v1',role:'PARENT',personId:parent,schoolId,learnerPersonId:learner,grantId,learnerName:'Synthetic learner',parentName:'Synthetic contact',expiresAt:new Date(Date.now()+30000).toISOString()});
 const s=async():Promise<ConversationAuthority>=>({allowed:true,contractVersion:'finance-conversations-v1',role:'STAFF',personId:officer,schoolId,expiresAt:new Date(Date.now()+30000).toISOString()});
 const directory=async()=>({contractVersion:'finance-conversations-v1' as const,personId:parent,scopes:[{grantId,schoolId,learnerPersonId:learner,schoolName:'Synthetic school',learnerReference:'SYN-COMMS',givenName:'Synthetic',familyName:'learner',actions:['family.finance.read' as const],expiresAt:new Date(Date.now()+30000).toISOString()}],truncated:false});
 try{
  await pool.query('INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)',[schoolId]);accountId=(await initializeFinance(pool,schoolId,principal,authority(principal))).accountId;const year=new Date().getUTCFullYear()+1,policy=JSON.parse(JSON.stringify(samplePolicy).replaceAll('2027',String(year))),calendar=await write({command:'SAVE_CALENDAR',expectedVersion:0,policy},principal);
  let activity=await write({command:'CREATE_ACTIVITY',details:{calendarId:calendar.id,title:'Synthetic trip notice',description:'Synthetic private question test',audience:'Not authority',eventDate:`${year}-12-05`,paymentDeadline:`${year}-11-01`,amountMinor:'15000',optional:true}});
  for(const [command,actor]of[['SUBMIT_ACTIVITY',officer],['APPROVE_ACTIVITY',principal],['PUBLISH_ACTIVITY',principal]] as const)activity=await write({command,activityId:activity.id,revision:activity.revision,reason:'Synthetic reviewed notice'},actor);
  const notice=await offerActivity(pool,scope(),{activityId:activity.id,revision:activity.revision,learnerReference:'SYN-COMMS',eligibilityChecked:true},authority(officer),async()=>learner),target={offerId:notice.id};
  const inbox=await readParentInbox(pool,directory);assert.equal(inbox.notices[0].noticeId,notice.id);assert.equal(inbox.unread,1);assert.equal((await readParentInbox(pool,directory,{noticeId:notice.id})).notices.length,1);
  assert.equal((await readParentInbox(pool,async()=>({...await directory(),scopes:[]}))).notices.length,0);
  await conversation(pool,target,p,{command:'READ',through:'0'});assert.equal((await readParentInbox(pool,directory)).unread,0);
  const requestId=randomUUID(),command={command:'MESSAGE' as const,message:{requestId,body:'Can I ask about the activity?'}};
  const [a,b]=await Promise.all([conversation(pool,target,p,command),conversation(pool,target,p,command)]);assert.deepEqual(a,b);const sent=a as {id:string;threadId:string};
  await assert.rejects(conversation(pool,target,p,{...command,message:{requestId,body:'A different message'}}),/CONVERSATION_REQUEST_CONFLICT/);
  const outsiderId=randomUUID(),other=async():Promise<ConversationAuthority>=>({...await p(),personId:outsiderId});
  const hidden=await conversation(pool,target,other) as {messages:unknown[];threadId:null};assert.equal(hidden.messages.length,0);assert.equal(hidden.threadId,null);
  await assert.rejects(conversation(pool,{threadId:sent.threadId},other),/CONVERSATION_UNAVAILABLE/);
  await assert.rejects(conversation(pool,target,async()=>({...await p(),learnerPersonId:randomUUID()})),/CONVERSATION_UNAVAILABLE/);
  let calls=0;await assert.rejects(conversation(pool,target,async()=>{if(++calls>1)throw Error('revoked');return p();}, {command:'MESSAGE',message:{requestId:randomUUID(),body:'Must roll back'}}),/revoked/);
  assert.equal((await readStaffConversations(pool,s)).threads[0].unread,true);
  await conversation(pool,{threadId:sent.threadId},s,{command:'MESSAGE',message:{requestId:randomUUID(),body:'The school can help.'}});assert.equal((await readParentInbox(pool,directory)).unread,1);
  let view=await conversation(pool,target,p) as {messages:{sequence:string}[];resolved:boolean};assert.equal(view.messages.length,2);
  await conversation(pool,target,p,{command:'READ',through:view.messages.at(-1)!.sequence});assert.equal((await readParentInbox(pool,directory)).unread,0);
  await assert.rejects(conversation(pool,target,p,{command:'READ',through:'999999999999999999'}),/CONVERSATION_READ_CHANGED/);
  await assert.rejects(conversation(pool,target,p,{command:'RESOLVE',requestId:randomUUID()}),/CONVERSATION_FORBIDDEN/);
  await conversation(pool,{threadId:sent.threadId},s,{command:'RESOLVE',requestId:randomUUID()});view=await conversation(pool,target,p) as typeof view;assert.equal(view.resolved,true);
  await conversation(pool,target,p,{command:'MESSAGE',message:{requestId:randomUUID(),body:'One more question'}});view=await conversation(pool,target,p) as typeof view;assert.equal(view.resolved,false);
  for(let n=0;n<51;n++)await pool.query("INSERT INTO school_comms.messages(id,account_id,thread_id,request_id,author_person_id,author_kind,body,digest,created_at) VALUES($1,$2,$3,$4,$5,'STAFF',$6,$7,now()-interval '2 minutes')",[randomUUID(),accountId,sent.threadId,randomUUID(),officer,`Synthetic pagination ${n}`,'0'.repeat(64)]);
  const page=await conversation(pool,target,p) as {messages:{sequence:string}[];hasMore:boolean;before:string};assert.equal(page.messages.length,50);assert.equal(page.hasMore,true);const earlier=await conversation(pool,{...target,before:page.before},p) as {messages:unknown[]};assert.equal(earlier.messages.length,4);
  const client=await pool.connect();try{await client.query('SET ROLE spacecase_runtime');const runtime={connect:async()=>({query:(sql:string,args?:unknown[])=>client.query(sql,args),release:()=>{}})} as unknown as Pool;
   await conversation(runtime,target,p,{command:'MESSAGE',message:{requestId:randomUUID(),body:'Restricted runtime reply'}});assert.equal((await conversation(runtime,target,p) as {messages:unknown[]}).messages.length,50);
   assert.deepEqual((await client.query("SELECT has_table_privilege(current_user,'school_comms.messages','UPDATE') AS overwrite,has_table_privilege(current_user,'school_comms.messages','DELETE') AS erase,has_table_privilege(current_user,'school_comms.delivery_events','SELECT') AS outbox")).rows[0],{overwrite:false,erase:false,outbox:false});
  }finally{await client.query('RESET ROLE');client.release();}
  for(const table of ['invoices','payments','allocations'])assert.equal((await pool.query(`SELECT count(*)::int AS n FROM school_finance.${table} WHERE account_id=$1`,[accountId])).rows[0].n,0);
  const logs=JSON.stringify((await pool.query('SELECT metadata FROM school_finance.audit_events WHERE account_id=$1',[accountId])).rows);assert.equal(logs.includes('Can I ask'),false);
 }finally{
  if(old===undefined)delete process.env.SPACECASE_PARENT_INBOX_ENABLED;else process.env.SPACECASE_PARENT_INBOX_ENABLED=old;
  if(accountId){for(const table of ['reads','thread_events','messages','threads','notice_reads','delivery_events'])await pool.query(`DELETE FROM school_comms.${table} WHERE account_id=$1`,[accountId]);for(const table of ['activity_offers','activity_requests','activity_versions','activity_calendars','audit_events'])await pool.query(`DELETE FROM school_finance.${table} WHERE account_id=$1`,[accountId]);await pool.query('DELETE FROM school_finance.accounts WHERE id=$1',[accountId]);await pool.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[schoolId]);}await pool.end();
 }
});
