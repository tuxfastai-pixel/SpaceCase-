import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {Pool} from 'pg';
import {createTicket,replyTicket} from '../../domains/support/service';import {prepareEngineeringHandoff} from '../../domains/support/engineering';
test('reviewed handoff binds current open ticket and audits only digest without disclosing source narrative',{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),school=randomUUID(),owner={personId:randomUUID(),founder:false,schools:[{id:school,displayName:'Private school'}]},founder={personId:randomUUID(),founder:true,schools:[]};
 try{
  const ticket=await createTicket(pool,owner,{requestId:randomUUID(),schoolId:school,category:'BUG',impact:'DEGRADED',area:'OTHER',title:'Private title which must not leave the ticket',description:'Private original narrative which must never be copied.'});
  const input={ticketId:ticket.id,revision:0,privacyReviewed:true as const,brief:{problem:'Synthetic date entry stays in the year.',expected:'Advance after four digits.',observed:'The year field continues accepting digits.',steps:['Open a synthetic report.','Type four year digits.'],acceptance:['Focus advances to month.']}};
  await assert.rejects(prepareEngineeringHandoff(pool,owner,input),/FOUNDER_REQUIRED/);
  await assert.rejects(prepareEngineeringHandoff(pool,founder,{...input,revision:1}),/TICKET_CHANGED/);
  const result=await prepareEngineeringHandoff(pool,founder,input),again=await prepareEngineeringHandoff(pool,founder,input);assert.deepEqual(result,again);assert.equal(result.executionStarted,false);assert.equal(result.digest,createHash('sha256').update(JSON.stringify(result.handoff)).digest('hex'));
  for(const secret of [school,owner.personId,founder.personId,ticket.id,'Private'])assert.equal(JSON.stringify(result).includes(secret),false);
  const events=await pool.query('SELECT count(*)::int AS n FROM support.events WHERE ticket_id=$1',[ticket.id]);assert.equal(events.rows[0].n,1);assert.equal((await pool.query('SELECT count(*)::int AS n FROM support.proposals WHERE ticket_id=$1',[ticket.id])).rows[0].n,0);
  const audit=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE resource_id=$1 AND action='support.engineering.handoff'",[ticket.id]);assert.equal(audit.rowCount,2);assert.deepEqual(audit.rows[0].metadata,{contractVersion:'psg.engineering-handoff.v1',sourceRevision:0,digest:result.digest});assert.equal(JSON.stringify(audit.rows).includes(input.brief.problem),false);
  await replyTicket(pool,owner,ticket.id,{revision:0,message:'Updated reproduction information.',reopen:false});await assert.rejects(prepareEngineeringHandoff(pool,founder,input),/TICKET_CHANGED/);
  await pool.query("UPDATE support.tickets SET status='CLOSED' WHERE id=$1",[ticket.id]);await assert.rejects(prepareEngineeringHandoff(pool,founder,{...input,revision:1}),/CASE_CLOSED/);
  await assert.rejects(prepareEngineeringHandoff(pool,founder,{...input,ticketId:randomUUID()}),/TICKET_UNAVAILABLE/);
 }finally{await pool.query('DELETE FROM support.events WHERE ticket_id IN(SELECT id FROM support.tickets WHERE school_id=$1)',[school]);await pool.query('DELETE FROM support.tickets WHERE school_id=$1',[school]);await pool.query('DELETE FROM audit.product_audit_events WHERE school_id=$1',[school]);await pool.end();}
});
