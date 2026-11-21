import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {initializeFinance,type FinanceAuthority} from '../../domains/school-finance/workspaceService';
import {readActivityRegister,writeActivityRegister} from '../../domains/school-activities/registerService';
import {registerCommand} from '../../domains/school-activities/registerContracts';
import {samplePolicy} from './fixtures';
test('saved activities serialize replay, preserve calendar/decision versions and enforce independent school-scoped review under restricted runtime',{timeout:60000},async t=>{
 if(!process.env.DATABASE_URL){t.skip('Requires isolated PostgreSQL');return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:6}),schoolId=randomUUID(),principal=randomUUID(),officer=randomUUID();let accountId='';
 const authority=(personId:string):FinanceAuthority=>async school=>({schoolId:school,personId});
 const scope=(actorPersonId=officer)=>({schoolId,accountId,actorPersonId});
 const cmd=(value:Record<string,unknown>)=>registerCommand.parse({schoolId,accountId,requestId:randomUUID(),...value});
 const write=(value:Record<string,unknown>,actor=officer)=>writeActivityRegister(pool,scope(actor),cmd(value),authority(actor));
 try{
  await pool.query('INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)',[schoolId]);accountId=(await initializeFinance(pool,schoolId,principal,authority(principal))).accountId;
  const calendar=await write({command:'SAVE_CALENDAR',expectedVersion:0,policy:samplePolicy},principal);
  const details={calendarId:calendar.id,title:'Synthetic trip',description:'Isolated activity test',audience:'Synthetic class',eventDate:'2027-05-10',paymentDeadline:'2027-05-01',amountMinor:'35000',optional:true};
  const create=cmd({command:'CREATE_ACTIVITY',details});
  const [one,two]=await Promise.all([writeActivityRegister(pool,scope(),create,authority(officer)),writeActivityRegister(pool,scope(),create,authority(officer))]);assert.deepEqual(one,two);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.activity_versions WHERE account_id=$1',[accountId])).rows[0].n,1);
  await assert.rejects(writeActivityRegister(pool,scope(),registerCommand.parse({...create,details:{...details,title:'Changed replay'}}),authority(officer)),/ACTIVITY_REQUEST_CONFLICT/);
  await assert.rejects(writeActivityRegister(pool,scope(principal),create,authority(principal)),/ACTIVITY_REQUEST_CONFLICT/);
  await assert.rejects(writeActivityRegister(pool,{...scope(),schoolId:randomUUID()},registerCommand.parse({...create,schoolId:randomUUID()}),authority(officer)),/FINANCE_FORBIDDEN/);
  await assert.rejects(readActivityRegister(pool,{...scope(),schoolId:randomUUID()},authority(officer)),/FINANCE_ACCOUNT_UNAVAILABLE/);
  await assert.rejects(write({command:'EDIT_ACTIVITY',activityId:one.id,revision:1,details},principal),/ACTIVITY_NOT_REVIEWABLE/);
  let saved=await write({command:'SUBMIT_ACTIVITY',activityId:one.id,revision:1,reason:'Ready for review'});
  await assert.rejects(write({command:'APPROVE_ACTIVITY',activityId:one.id,revision:saved.revision,reason:'Self approval'},officer),/ACTIVITY_NOT_REVIEWABLE/);
  saved=await write({command:'REJECT_ACTIVITY',activityId:one.id,revision:saved.revision,reason:'Please check the dates'},principal);
  saved=await write({command:'EDIT_ACTIVITY',activityId:one.id,revision:saved.revision,details:{...details,title:'Corrected synthetic trip'}});
  saved=await write({command:'SUBMIT_ACTIVITY',activityId:one.id,revision:saved.revision,reason:'Dates checked'});
  const competing=await Promise.allSettled([write({command:'APPROVE_ACTIVITY',activityId:one.id,revision:saved.revision,reason:'Independent check complete'},principal),write({command:'REJECT_ACTIVITY',activityId:one.id,revision:saved.revision,reason:'Competing review'},principal)]);
  assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);assert.match(String((competing.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/ACTIVITY_REVISION_CHANGED/);
  let latest=(await readActivityRegister(pool,scope(),authority(officer))).activities[0];
  if(latest.status==='REJECTED'){saved=await write({command:'EDIT_ACTIVITY',activityId:one.id,revision:latest.revision,details});saved=await write({command:'SUBMIT_ACTIVITY',activityId:one.id,revision:saved.revision,reason:'Rechecked'});await write({command:'APPROVE_ACTIVITY',activityId:one.id,revision:saved.revision,reason:'Checked independently'},principal);latest=(await readActivityRegister(pool,scope(),authority(officer))).activities[0];}
  saved=await write({command:'PUBLISH_ACTIVITY',activityId:one.id,revision:latest.revision,reason:'Published to staff register'},principal);
  await assert.rejects(write({command:'EDIT_ACTIVITY',activityId:one.id,revision:saved.revision,details}),/ACTIVITY_NOT_REVIEWABLE/);
  await write({command:'SAVE_CALENDAR',expectedVersion:1,policy:{...samplePolicy,label:'Revised calendar'}},principal);
  await assert.rejects(write({command:'SAVE_CALENDAR',expectedVersion:1,policy:samplePolicy},principal),/ACTIVITY_REVISION_CHANGED/);
  const listed=await readActivityRegister(pool,scope(),authority(officer));assert.equal(listed.calendars.length,2);assert.equal(listed.activities[0].calendarId,calendar.id);assert.equal(listed.activities[0].status,'PUBLISHED');
  const rejected=await pool.query("SELECT reason FROM school_finance.activity_versions WHERE account_id=$1 AND status='REJECTED' ORDER BY revision",[accountId]);assert.equal(rejected.rows[0].reason,'Please check the dates');
  await assert.rejects(write({command:'CREATE_ACTIVITY',details:{...details,eventDate:'2028-01-02',paymentDeadline:'2028-01-01'}}),/ACTIVITY_DATE_INVALID/);
  const forbidden:FinanceAuthority=async()=>{throw Error('permission revoked');};await assert.rejects(readActivityRegister(pool,scope(),forbidden),/permission revoked/);
  const runtime=await pool.connect();try{
   await runtime.query('SET ROLE spacecase_runtime');
   const db={connect:async()=>({query:(sql:string,args?:unknown[])=>runtime.query(sql,args),release:()=>{}})} as unknown as Pool;
   await writeActivityRegister(db,scope(),cmd({command:'CREATE_ACTIVITY',details}),authority(officer));assert.ok((await readActivityRegister(db,scope(),authority(officer))).activities.length>=2);
   const rights=await runtime.query("SELECT has_table_privilege(current_user,'school_finance.activity_versions','UPDATE') AS overwrite,has_table_privilege(current_user,'school_finance.activity_calendars','DELETE') AS deletion,has_table_privilege(current_user,'school_finance.activity_requests','UPDATE') AS rewrite");assert.deepEqual(rights.rows[0],{overwrite:false,deletion:false,rewrite:false});
  }finally{await runtime.query('RESET ROLE');runtime.release();}
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM school_finance.invoices WHERE account_id=$1',[accountId])).rows[0].n,0);
 }finally{
  if(accountId){for(const table of ['activity_requests','activity_versions','activity_calendars','audit_events'])await pool.query(`DELETE FROM school_finance.${table} WHERE account_id=$1`,[accountId]);await pool.query('DELETE FROM school_finance.accounts WHERE id=$1',[accountId]);await pool.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[schoolId]);}await pool.end();
 }
});
