import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";
import {Pool} from "pg";
import {ticketInput,type SupportContext} from "../../domains/support/contracts";
import {createTicket,getTicket,listTickets,replyTicket,updateTicket,prepareRecommendation,decideRecommendation} from "../../domains/support/service";
import {directoryHealth,schoolOperations} from "../../domains/support/operations";
test("support is private, idempotent, revocable and approval records never execute changes",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const schoolId=randomUUID();const owner:SupportContext={personId:randomUUID(),founder:false,schools:[{id:schoolId,displayName:"CI school"}]};const founder={...owner,personId:randomUUID(),founder:true};const other={...owner,personId:randomUUID()};
 const payload=ticketInput.parse({requestId:randomUUID(),schoolId,category:"BUG",impact:"BLOCKED",area:"ATTENDANCE",title:"CI private issue title",description:"The save operation stopped before confirmation."});
 try{
 const pair=await Promise.all([createTicket(pool,owner,payload),createTicket(pool,owner,payload)]);assert.equal(pair[0].id,pair[1].id);assert.match(pair[0].reference,/^SC-/);
 const id=pair[0].id;assert.equal((await getTicket(pool,owner,id)).events.length,1);
 await assert.rejects(createTicket(pool,owner,{...payload,title:"Different payload"}),/REQUEST_CHANGED/);
 await assert.rejects(getTicket(pool,other,id),/TICKET_UNAVAILABLE/);await assert.rejects(getTicket(pool,{...owner,schools:[]},id),/TICKET_UNAVAILABLE/);
 await assert.rejects(getTicket(pool,owner,id,true),/FOUNDER_REQUIRED/);
 assert.equal((await listTickets(pool,other,{offset:0})).tickets.length,0);
 await assert.rejects(listTickets(pool,owner,{offset:0,schoolId:randomUUID()}),/SCHOOL_ACCESS_REQUIRED/);
 assert.equal((await directoryHealth(pool,founder,[schoolId]))[0].openTickets,1);
 const preview=await schoolOperations(pool,founder,schoolId,[]);assert.ok(preview.audit.length);assert.equal("metadata" in preview.audit[0],false);assert.equal("learnerPersonId" in preview.audit[0],false);
 await assert.rejects(updateTicket(pool,owner,{ticketId:id,revision:0,status:"RESOLVED",priority:"NORMAL",message:"Not authorized"}),/FOUNDER_REQUIRED/);
 await updateTicket(pool,founder,{ticketId:id,revision:0,status:"RESOLVED",priority:"HIGH",message:"A fix was checked; please confirm the result."});
 await assert.rejects(replyTicket(pool,owner,id,{revision:0,message:"Old version",reopen:true}),/TICKET_CHANGED/);
 await replyTicket(pool,owner,id,{revision:1,message:"The issue is still reproducible.",reopen:true});
 assert.equal((await getTicket(pool,owner,id)).ticket.status,"UNDER_REVIEW");
 const proposal={ticketId:id,summary:"A prepared candidate change",benefit:"Restore reliable saves",risks:"Requires a controlled deployment",validation:"Candidate tests passed; live confirmation pending",rollback:"Revert the application deployment",changeUrl:""};
 const first=await prepareRecommendation(pool,founder,proposal);
 await assert.rejects(decideRecommendation(pool,founder,{proposalId:first.proposalId,decision:"APPROVED",reason:"Reviewed evidence"}),/CHANGE_REFERENCE_REQUIRED/);
 const second=await prepareRecommendation(pool,founder,{...proposal,changeUrl:"https://github.com/tuxfastai-pixel/SpaceCase-/pull/1"});
 await assert.rejects(decideRecommendation(pool,founder,{proposalId:first.proposalId,decision:"APPROVED",reason:"Old candidate"}),/PROPOSAL_CHANGED/);
 const decided=await decideRecommendation(pool,founder,{proposalId:second.proposalId,decision:"APPROVED",reason:"Reviewed the prepared change and validation"});
 assert.equal(decided.executionStarted,false);assert.equal((await getTicket(pool,owner,id)).ticket.status,"UNDER_REVIEW");assert.equal((await getTicket(pool,owner,id)).proposal,null);
 await assert.rejects(decideRecommendation(pool,founder,{proposalId:second.proposalId,decision:"DECLINED",reason:"Conflicting decision"}),/PROPOSAL_CHANGED/);
 assert.equal((await getTicket(pool,founder,id,true)).proposal.decision,"APPROVED");
 const retained=await pool.query("SELECT count(*)::int AS total FROM support.proposals WHERE ticket_id=$1",[id]);assert.equal(retained.rows[0].total,2);
 for(let i=0;i<4;i++)await createTicket(pool,owner,{...payload,requestId:randomUUID(),title:"CI additional issue "+i});
 await assert.rejects(createTicket(pool,owner,{...payload,requestId:randomUUID()}),/SUBMISSION_LIMIT/);
 const audit=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE school_id=$1",[schoolId]);assert.ok(audit.rows.length);assert.equal(JSON.stringify(audit.rows).includes(payload.title),false);
 }finally{
 await pool.query("DELETE FROM support.proposals WHERE ticket_id IN (SELECT id FROM support.tickets WHERE school_id=$1)",[schoolId]);
 await pool.query("DELETE FROM support.events WHERE ticket_id IN (SELECT id FROM support.tickets WHERE school_id=$1)",[schoolId]);
 await pool.query("DELETE FROM support.tickets WHERE school_id=$1",[schoolId]);await pool.query("DELETE FROM audit.product_audit_events WHERE school_id=$1 OR actor_person_id=ANY($2::text[])",[schoolId,[owner.personId,other.personId,founder.personId]]);await pool.end();
 }
});
