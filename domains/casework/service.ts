import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {assertFounder,SupportError,type SupportContext} from "../support/contracts";
import {assertAgent,type WorkAction} from "./contracts";
const ticketProjection=`t.id,t.reference,t.school_id AS "schoolId",t.title,t.description,t.status,t.priority,t.revision,t.area,t.category,t.impact,t.created_at AS "createdAt",t.updated_at AS "updatedAt"`;
async function audit(db:PoolClient,c:SupportContext,schoolId:string,ticketId:string,action:string){await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at) VALUES(gen_random_uuid(),$1,$2,'SUPPORT_CASEWORK',$3,$4,'ALLOW','current_peos_casework_authority','{}'::jsonb,clock_timestamp())`,[c.personId,"support.work."+action, ticketId,schoolId]);}
async function transaction<T>(pool:Pool,run:(db:PoolClient)=>Promise<T>){const db=await pool.connect();try{await db.query("BEGIN");const value=await run(db);await db.query("COMMIT");return value;}catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}}
export async function readWork(pool:Pool,c:SupportContext,ticketId:string,founder=false){
 if(founder)assertFounder(c);else assertAgent(c);
 return transaction(pool,async db=>{
 const r=await db.query("SELECT "+ticketProjection+",w.owner_person_id AS \"ownerPersonId\",w.escalation_state AS \"escalationState\",w.escalation_reason AS \"escalationReason\" FROM support.tickets t LEFT JOIN support.ticket_work w ON w.ticket_id=t.id WHERE t.id=$1"+(founder?"":" AND w.owner_person_id=$2 AND t.school_id=ANY($3::text[])"),founder?[ticketId]:[ticketId,c.personId,c.agentSchools!.map(s=>s.id)]);
 const ticket=r.rows[0];if(!ticket)throw new SupportError("CASE_UNAVAILABLE",404);
 const events=await db.query('SELECT id,kind,status,message,created_at AS "createdAt" FROM support.events WHERE ticket_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101',[ticketId]);
 const workEvents=await db.query('SELECT id,kind,note,from_owner_person_id AS "fromOwnerPersonId",to_owner_person_id AS "toOwnerPersonId",created_at AS "createdAt" FROM support.work_events WHERE ticket_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101',[ticketId]);
 await audit(db,c,ticket.schoolId,ticketId,"read");
 return {ticket,events:events.rows.slice(0,100).reverse(),eventsTruncated:events.rows.length>100,workEvents:workEvents.rows.slice(0,100).reverse(),workEventsTruncated:workEvents.rows.length>100};
 });
}
export async function mutateWork(pool:Pool,c:SupportContext,input:WorkAction,founder=false,eligibleOwnerIds:readonly string[]=[]){
 if(founder)assertFounder(c);else assertAgent(c);
 if(founder?!["ASSIGN","ACKNOWLEDGE"].includes(input.action):["ASSIGN","ACKNOWLEDGE"].includes(input.action))throw new SupportError("CASE_ACTION_FORBIDDEN");
 return transaction(pool,async db=>{
 // Serialise the actor request key, including reuse against another ticket, before locking the case.
 await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["case-request:"+c.personId+":"+input.requestId]);
 const result=await db.query('SELECT id,school_id AS "schoolId",status,revision FROM support.tickets WHERE id=$1 AND ($2::boolean OR school_id=ANY($3::text[])) FOR UPDATE',[input.ticketId,founder,c.agentSchools?.map(s=>s.id)??[]]);
 const ticket=result.rows[0];if(!ticket)throw new SupportError("CASE_UNAVAILABLE",404);
 if(!founder)assertAgent(c,ticket.schoolId);
 const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
 const previous=await db.query("SELECT payload_hash FROM support.work_requests WHERE actor_person_id=$1 AND request_id=$2",[c.personId,input.requestId]);
 if(previous.rows[0]){if(previous.rows[0].payload_hash!==hash)throw new SupportError("REQUEST_CHANGED",409);return {recorded:true};}
 if(ticket.revision!==input.revision)throw new SupportError("TICKET_CHANGED",409);
 if(["RESOLVED","CLOSED"].includes(ticket.status)&&input.action!=="ACKNOWLEDGE")throw new SupportError("CASE_CLOSED",409);
 await db.query("INSERT INTO support.ticket_work(ticket_id) VALUES($1) ON CONFLICT(ticket_id) DO NOTHING",[ticket.id]);
 const work=(await db.query('SELECT owner_person_id AS "ownerPersonId",escalation_state AS "escalationState" FROM support.ticket_work WHERE ticket_id=$1 FOR UPDATE',[ticket.id])).rows[0];
 let note="";
 if(input.action==="CLAIM"){
 if(work.ownerPersonId&&work.ownerPersonId!==c.personId)throw new SupportError("CASE_ALREADY_OWNED",409);
 await db.query("UPDATE support.ticket_work SET owner_person_id=$2,updated_at=clock_timestamp() WHERE ticket_id=$1",[ticket.id,c.personId]);
 }else if(input.action==="ASSIGN"){
 if(input.ownerPersonId&&!eligibleOwnerIds.includes(input.ownerPersonId))throw new SupportError("ELIGIBLE_AGENT_REQUIRED",400);
 await db.query("UPDATE support.ticket_work SET owner_person_id=$2,updated_at=clock_timestamp() WHERE ticket_id=$1",[ticket.id,input.ownerPersonId]);note=input.reason;
 }else if(input.action==="ACKNOWLEDGE"){
 if(work.escalationState!=="REQUESTED")throw new SupportError("NO_PENDING_ESCALATION",409);
 await db.query("UPDATE support.ticket_work SET escalation_state='ACKNOWLEDGED',updated_at=clock_timestamp() WHERE ticket_id=$1",[ticket.id]);note=input.reason;
 }else{
 if(work.ownerPersonId!==c.personId)throw new SupportError("CASE_OWNER_REQUIRED");
 if(input.action==="RELEASE"){await db.query("UPDATE support.ticket_work SET owner_person_id=NULL,updated_at=clock_timestamp() WHERE ticket_id=$1",[ticket.id]);note=input.reason;}
 if(input.action==="ESCALATE"){await db.query("UPDATE support.ticket_work SET escalation_state='REQUESTED',escalation_reason=$2,escalated_at=clock_timestamp(),updated_at=clock_timestamp() WHERE ticket_id=$1",[ticket.id,input.reason]);note=input.reason;}
 if(input.action==="REPLY"){
 await db.query("INSERT INTO support.events(ticket_id,actor_person_id,kind,status,message) VALUES($1,$2,'TECHNICAL_UPDATE',$3,$4)",[ticket.id,c.personId,ticket.status==="PLANNED"?"PLANNED":input.status,input.message]);
 note="Reporter-visible technical reply recorded";
 }
 }
 const status=input.action==="REPLY"?(ticket.status==="PLANNED"?"PLANNED":input.status):input.action==="CLAIM"&&ticket.status==="SUBMITTED"?"UNDER_REVIEW":ticket.status;
 await db.query("UPDATE support.tickets SET revision=revision+1,status=$2,updated_at=clock_timestamp() WHERE id=$1",[ticket.id,status]);
 const nextOwner=input.action==="CLAIM"?c.personId:input.action==="RELEASE"?null:input.action==="ASSIGN"?input.ownerPersonId:work.ownerPersonId;
 await db.query("INSERT INTO support.work_events(ticket_id,actor_person_id,kind,note,from_owner_person_id,to_owner_person_id) VALUES($1,$2,$3,$4,$5,$6)",[ticket.id,c.personId,input.action,note,work.ownerPersonId,nextOwner]);
 await db.query("INSERT INTO support.work_requests(actor_person_id,request_id,ticket_id,payload_hash) VALUES($1,$2,$3,$4)",[c.personId,input.requestId,ticket.id,hash]);
 await audit(db,c,ticket.schoolId,ticket.id,input.action.toLowerCase());return {recorded:true};
 });
}
export async function escalations(pool:Pool,c:SupportContext,offset=0){
 assertFounder(c);return transaction(pool,async db=>{
 const r=await db.query(`SELECT t.id,t.reference,t.school_id AS "schoolId",t.area,t.priority,t.status,t.revision,w.owner_person_id AS "ownerPersonId",w.escalated_at AS "escalatedAt" FROM support.ticket_work w JOIN support.tickets t ON t.id=w.ticket_id WHERE w.escalation_state='REQUESTED' ORDER BY w.escalated_at,w.ticket_id LIMIT 51 OFFSET $1`,[offset]);
 await audit(db,c,"",c.personId,"escalations.read");return {tickets:r.rows.slice(0,50),nextOffset:r.rows.length>50?offset+50:null};
 });
}
