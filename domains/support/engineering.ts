import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import type {z} from 'zod';
import {assertFounder,SupportError,type SupportContext} from './contracts';
import {createHandoff,handoffInput} from '../../packages/engineering-control/contracts';
export async function prepareEngineeringHandoff(pool:Pool,c:SupportContext,input:z.infer<typeof handoffInput>){
 assertFounder(c);const parsed=handoffInput.parse(input);const db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5000ms'");
  // Narrative, reporter identity and school information never enter the shared task contract.
  const r=await db.query(`SELECT id,reference,school_id AS "schoolId",revision,status,category,area FROM support.tickets WHERE id=$1 FOR SHARE`,[parsed.ticketId]);
  const ticket=r.rows[0];if(!ticket)throw new SupportError('TICKET_UNAVAILABLE',404);
  if(ticket.revision!==parsed.revision)throw new SupportError('TICKET_CHANGED',409);
  if(['RESOLVED','CLOSED'].includes(ticket.status))throw new SupportError('CASE_CLOSED',409);
  const handoff=createHandoff({reference:ticket.reference,revision:ticket.revision,category:ticket.category,area:ticket.area},parsed.brief);
  const digest=createHash('sha256').update(JSON.stringify(handoff)).digest('hex');
  await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
   VALUES(gen_random_uuid(),$1,'support.engineering.handoff','SUPPORT_TICKET',$2,$3,'ALLOW','founder_reviewed_brief',$4::jsonb,clock_timestamp())`,[c.personId,ticket.id,ticket.schoolId,JSON.stringify({contractVersion:handoff.contractVersion,sourceRevision:ticket.revision,digest})]);
  await db.query('COMMIT');return {handoff,digest,executionStarted:false as const};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
