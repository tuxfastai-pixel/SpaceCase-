import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {assertFounder,assertMember,SupportError,type SupportContext,ticketInput,replyInput,updateInput,recommendationInput,decisionInput,listQuery} from "./contracts";
import type {z} from "zod";
type DB=PoolClient;
async function tx<T>(pool:Pool,run:(db:DB)=>Promise<T>){const db=await pool.connect();try{await db.query("BEGIN");const result=await run(db);await db.query("COMMIT");return result;}catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}}
async function audit(db:DB,c:SupportContext,action:string,ticket:{id:string;schoolId:string},metadata:unknown={}){
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
 VALUES(gen_random_uuid(),$1,$2,'SUPPORT_TICKET',$3,$4,'ALLOW','current_peos_support_authority',$5::jsonb,clock_timestamp())`,[c.personId,action,ticket.id,ticket.schoolId,JSON.stringify(metadata)]);
}
const projection=`id,reference,school_id AS "schoolId",category,impact,area,title,description,status,priority,revision,created_at AS "createdAt",updated_at AS "updatedAt"`;
async function visible(db:DB,c:SupportContext,ticketId:string,founder=false,lock=false){
 if(founder)assertFounder(c);
 const r=await db.query("SELECT "+projection+" FROM support.tickets WHERE id=$1"+(founder?"":" AND requester_person_id=$2 AND school_id=ANY($3::text[])")+(lock?" FOR UPDATE":""),founder?[ticketId]:[ticketId,c.personId,c.schools.map(s=>s.id)]);
 if(!r.rows[0])throw new SupportError("TICKET_UNAVAILABLE",404);return r.rows[0];
}
async function event(db:DB,c:SupportContext,ticket: {id:string;status:string},kind:string,message:string){
 await db.query("INSERT INTO support.events(ticket_id,actor_person_id,kind,status,message) VALUES($1,$2,$3,$4,$5)",[ticket.id,c.personId,kind,ticket.status,message]);
}
export async function createTicket(pool:Pool,c:SupportContext,input:z.infer<typeof ticketInput>){
 assertMember(c,input.schoolId);
 return tx(pool,async db=>{
 await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["support-submit:"+c.personId]);
 const {requestId,...payload}=input;const hash=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 const existing=await db.query("SELECT id,reference,payload_hash FROM support.tickets WHERE requester_person_id=$1 AND request_id=$2",[c.personId,requestId]);
 if(existing.rows[0]){if(existing.rows[0].payload_hash!==hash)throw new SupportError("REQUEST_CHANGED",409);return {id:existing.rows[0].id,reference:existing.rows[0].reference,logged:true};}
 const recent=await db.query("SELECT count(*)::int AS total FROM support.tickets WHERE requester_person_id=$1 AND created_at>clock_timestamp()-interval '1 hour'",[c.personId]);
 if(recent.rows[0].total>=5)throw new SupportError("SUBMISSION_LIMIT",429);
 const r=await db.query(`INSERT INTO support.tickets(requester_person_id,request_id,payload_hash,school_id,category,impact,area,title,description)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING `+projection,[c.personId,requestId,hash,input.schoolId,input.category,input.impact,input.area,input.title,input.description]);
 const ticket=r.rows[0];await event(db,c,ticket,"SUBMISSION","Your submission has been logged for technical review. No automated investigation or email delivery has started.");
 await audit(db,c,"support.ticket.create",ticket,{category:input.category,area:input.area});
 return {id:ticket.id,reference:ticket.reference,logged:true};
 });
}
export async function listTickets(pool:Pool,c:SupportContext,query:z.infer<typeof listQuery>,founder=false){
 if(founder)assertFounder(c);
 return tx(pool,async db=>{
 const r=await db.query("SELECT "+projection+` FROM support.tickets WHERE ($1::boolean OR (requester_person_id=$2 AND school_id=ANY($3::text[])))
 AND ($4::text IS NULL OR status=$4) AND ($5::text IS NULL OR school_id=$5)
 ORDER BY CASE WHEN $1 THEN CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END ELSE 0 END,created_at DESC,id DESC LIMIT 51 OFFSET $6`,
 [founder,c.personId,c.schools.map(s=>s.id),query.status??null,query.schoolId??null,query.offset]);
 const pending=founder?await db.query(`SELECT p.id,p.ticket_id AS "ticketId",p.summary,t.reference,t.school_id AS "schoolId" FROM support.proposals p JOIN support.tickets t ON t.id=p.ticket_id
 WHERE p.decision='READY' AND ($1::text IS NULL OR t.school_id=$1) AND p.id=(SELECT p2.id FROM support.proposals p2 WHERE p2.ticket_id=p.ticket_id ORDER BY p2.created_at DESC,p2.id DESC LIMIT 1) ORDER BY p.created_at LIMIT 50`,[query.schoolId??null]):{rows:[]};
 await audit(db,c,founder?"support.inbox.read":"support.own.list",{id:c.personId,schoolId:query.schoolId??""});
 return {tickets:r.rows.slice(0,50),nextOffset:r.rows.length>50?query.offset+50:null,pending:pending.rows};
 });
}
export async function getTicket(pool:Pool,c:SupportContext,ticketId:string,founder=false){
 return tx(pool,async db=>{
 const ticket=await visible(db,c,ticketId,founder);
 const events=await db.query('SELECT id,kind,status,message,created_at AS "createdAt" FROM support.events WHERE ticket_id=$1 ORDER BY created_at DESC,id DESC LIMIT 201',[ticketId]);
 const proposal=founder?await db.query(`SELECT id,summary,benefit,risks,validation,rollback,change_url AS "changeUrl",decision,decision_reason AS "decisionReason",created_at AS "createdAt"
 FROM support.proposals WHERE ticket_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[ticketId]):{rows:[]};
 await audit(db,c,"support.ticket.read",ticket);
 return {ticket,events:events.rows.slice(0,200).reverse(),eventsTruncated:events.rows.length>200,proposal:proposal.rows[0]??null};
 });
}
export async function replyTicket(pool:Pool,c:SupportContext,ticketId:string,input:z.infer<typeof replyInput>){
 return tx(pool,async db=>{
 const ticket=await visible(db,c,ticketId,false,true);
 if(ticket.revision!==input.revision)throw new SupportError("TICKET_CHANGED",409);
 if(input.reopen&&!["RESOLVED","CLOSED"].includes(ticket.status))throw new SupportError("TICKET_CHANGED",409);
 const status=input.reopen?"UNDER_REVIEW":ticket.status;
 await db.query("UPDATE support.tickets SET status=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",[ticketId,status]);
 await event(db,c,{...ticket,status},"USER_REPLY",input.message);await audit(db,c,"support.ticket.reply",ticket,{reopened:input.reopen});
 return {updated:true};
 });
}
export async function updateTicket(pool:Pool,c:SupportContext,input:z.infer<typeof updateInput>){
 assertFounder(c);return tx(pool,async db=>{
 const ticket=await visible(db,c,input.ticketId,true,true);if(ticket.revision!==input.revision)throw new SupportError("TICKET_CHANGED",409);
 await db.query("UPDATE support.tickets SET status=$2,priority=$3,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",[ticket.id,input.status,input.priority]);
 await event(db,c,{...ticket,status:input.status},"TECHNICAL_UPDATE",input.message);
 await audit(db,c,"support.ticket.update",ticket,{from:ticket.status,to:input.status,priority:input.priority});return {updated:true};
 });
}
export async function prepareRecommendation(pool:Pool,c:SupportContext,input:z.infer<typeof recommendationInput>){
 assertFounder(c);return tx(pool,async db=>{
 const ticket=await visible(db,c,input.ticketId,true,true);
 const r=await db.query(`INSERT INTO support.proposals(ticket_id,prepared_by,summary,benefit,risks,validation,rollback,change_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()) RETURNING id`,
 [ticket.id,c.personId,input.summary,input.benefit,input.risks,input.validation,input.rollback,input.changeUrl]);
 await audit(db,c,"support.recommendation.prepare",ticket,{proposalId:r.rows[0].id});return {proposalId:r.rows[0].id};
 });
}
export async function decideRecommendation(pool:Pool,c:SupportContext,input:z.infer<typeof decisionInput>){
 assertFounder(c);return tx(pool,async db=>{
 const ref=await db.query("SELECT ticket_id FROM support.proposals WHERE id=$1",[input.proposalId]);if(!ref.rows[0])throw new SupportError("PROPOSAL_UNAVAILABLE",404);
 const ticket=await visible(db,c,ref.rows[0].ticket_id,true,true);
 const latest=await db.query("SELECT id,decision,change_url FROM support.proposals WHERE ticket_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[ticket.id]);
 if(latest.rows[0].id!==input.proposalId||latest.rows[0].decision!=="READY")throw new SupportError("PROPOSAL_CHANGED",409);
 if(input.decision==="APPROVED"&&!latest.rows[0].change_url)throw new SupportError("CHANGE_REFERENCE_REQUIRED",409);
 await db.query("UPDATE support.proposals SET decision=$2,decision_reason=$3,decided_by=$4,decided_at=clock_timestamp() WHERE id=$1",[input.proposalId,input.decision,input.reason,c.personId]);
 await audit(db,c,"support.recommendation.decide",ticket,{proposalId:input.proposalId,decision:input.decision});return {recorded:true,executionStarted:false};
 });
}
