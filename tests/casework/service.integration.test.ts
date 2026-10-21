import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {createTicket,getTicket,updateTicket} from "../../domains/support/service";
import {readWork,mutateWork,escalations} from "../../domains/casework/service";
import {observerQueue} from "../../domains/operations/service";
import type {SupportContext} from "../../domains/support/contracts";
test("casework has exclusive claims, scoped owner-only narratives, idempotent replies and private escalations",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const schoolId=randomUUID();const people=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
 const founder:SupportContext={personId:people[0],founder:true,schools:[]};const reporter:SupportContext={personId:people[1],founder:false,schools:[{id:schoolId,displayName:"School"}]};
 const makeAgent=(personId:string):SupportContext=>({personId,founder:false,schools:[],observerSchools:[{id:schoolId,displayName:"School"}],agentSchools:[{id:schoolId,displayName:"School"}]});
 const a=makeAgent(people[2]),b=makeAgent(people[3]);const observer={...a,agentSchools:[]};let ticketId="";
 try{
 const created=await createTicket(pool,reporter,{requestId:randomUUID(),schoolId,category:"BUG",impact:"BLOCKED",area:"ATTENDANCE",title:"Private reproduction",description:"Private details belonging in a support case only."});ticketId=created.id;
 await assert.rejects(readWork(pool,a,ticketId),/CASE_UNAVAILABLE/);await assert.rejects(readWork(pool,observer,ticketId),/SUPPORT_AGENT_REQUIRED/);
 const claim=(person:SupportContext)=>mutateWork(pool,person,{action:"CLAIM",ticketId,requestId:randomUUID(),revision:0});
 const claims=await Promise.allSettled([claim(a),claim(b)]);assert.equal(claims.filter(r=>r.status==="fulfilled").length,1);
 const owner=claims[0].status==="fulfilled"?a:b,other=owner===a?b:a;
 assert.equal((await readWork(pool,owner,ticketId)).ticket.revision,1);await assert.rejects(readWork(pool,other,ticketId),/CASE_UNAVAILABLE/);
 const agentOnlyQueue=await observerQueue(pool,{...owner,observerSchools:[]});assert.equal(agentOnlyQueue.tickets[0].canHandle,true);assert.equal(agentOnlyQueue.tickets[0].id,ticketId);
 const queue=await observerQueue(pool,observer);assert.equal(queue.tickets[0].id,undefined);assert.equal(JSON.stringify(queue).includes("Private reproduction"),false);
 const reply={action:"REPLY" as const,ticketId,requestId:randomUUID(),revision:1,status:"NEEDS_INFORMATION" as const,message:"Please confirm which step stopped working."};
 await Promise.all([mutateWork(pool,owner,reply),mutateWork(pool,owner,reply)]);
 const visible=await getTicket(pool,reporter,ticketId);assert.equal(visible.events.filter(e=>e.message===reply.message).length,1);assert.equal(visible.ticket.revision,2);
 await assert.rejects(mutateWork(pool,owner,{...reply,message:"Changed request"}),/REQUEST_CHANGED/);
 await assert.rejects(mutateWork(pool,{...owner,agentSchools:[]},{action:"CLAIM",ticketId,requestId:randomUUID(),revision:2}),/SUPPORT_AGENT_REQUIRED/);
 await mutateWork(pool,owner,{action:"ESCALATE",ticketId,requestId:randomUUID(),revision:2,reason:"Internal operational reason for founder review"});
 assert.equal((await escalations(pool,founder)).tickets.some(t=>t.id===ticketId),true);
 assert.equal(JSON.stringify(await getTicket(pool,reporter,ticketId)).includes("Internal operational reason"),false);
 await assert.rejects(escalations(pool,owner),/FOUNDER_REQUIRED/);
 await mutateWork(pool,founder,{action:"ACKNOWLEDGE",ticketId,requestId:randomUUID(),revision:3,reason:"Founder has reviewed and planned the next action"},true);
 assert.equal((await escalations(pool,founder)).tickets.some(t=>t.id===ticketId),false);
 await assert.rejects(mutateWork(pool,founder,{action:"ASSIGN",ticketId,requestId:randomUUID(),revision:4,ownerPersonId:other.personId,reason:"Move responsibility to another agent"},true),/ELIGIBLE_AGENT_REQUIRED/);
 await mutateWork(pool,founder,{action:"ASSIGN",ticketId,requestId:randomUUID(),revision:4,ownerPersonId:other.personId,reason:"Move responsibility to another agent"},true,[other.personId]);
 await assert.rejects(readWork(pool,owner,ticketId),/CASE_UNAVAILABLE/);assert.equal((await readWork(pool,other,ticketId)).ticket.ownerPersonId,other.personId);
 await updateTicket(pool,founder,{ticketId,revision:5,status:"PLANNED",priority:"HIGH",message:"Prepared work is planned for review"});
 await mutateWork(pool,other,{action:"REPLY",ticketId,requestId:randomUUID(),revision:6,status:"UNDER_REVIEW",message:"We are following up the planned change."});
 assert.equal((await getTicket(pool,reporter,ticketId)).ticket.status,"PLANNED");
 await mutateWork(pool,other,{action:"RELEASE",ticketId,requestId:randomUUID(),revision:7,reason:"Release for the next support shift"});await assert.rejects(readWork(pool,other,ticketId),/CASE_UNAVAILABLE/);
 const events=await pool.query("SELECT from_owner_person_id,to_owner_person_id FROM support.work_events WHERE ticket_id=$1 AND kind='ASSIGN'",[ticketId]);assert.equal(events.rows[0].from_owner_person_id,owner.personId);assert.equal(events.rows[0].to_owner_person_id,other.personId);
 }finally{
 if(ticketId){for(const table of ["work_requests","work_events","ticket_work","events"])await pool.query("DELETE FROM support."+table+" WHERE ticket_id=$1",[ticketId]);await pool.query("DELETE FROM support.tickets WHERE id=$1",[ticketId]);}await pool.query("DELETE FROM audit.product_audit_events WHERE actor_person_id=ANY($1::text[])",[people]);await pool.end();
 }
});
