import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {observerQueue} from "../../domains/operations/service";
import {createTicket,getTicket} from "../../domains/support/service";
import type {SupportContext} from "../../domains/support/contracts";
test("observer queue is bounded to assigned schools and never exposes submitted narratives",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const schoolId=randomUUID(),otherSchool=randomUUID(),owner=randomUUID(),personId=randomUUID();const c:SupportContext={personId,founder:false,schools:[],observerSchools:[{id:schoolId,displayName:"CI school"}]};
 try{
 const payload={requestId:randomUUID(),schoolId,category:"BUG" as const,impact:"BLOCKED" as const,area:"OTHER" as const,title:"Private learner narrative",description:"Private description should never reach observers."};
 const ticket=await createTicket(pool,{personId:owner,founder:false,schools:[{id:schoolId,displayName:"CI"}]},payload);
 await createTicket(pool,{personId:owner,founder:false,schools:[{id:otherSchool,displayName:"Other"}]},{...payload,schoolId:otherSchool,requestId:randomUUID()});
 const result=await observerQueue(pool,c);assert.equal(result.tickets.length,1);assert.equal(result.tickets[0].reference,ticket.reference);assert.equal(result.readOnly,true);
 const encoded=JSON.stringify(result);for(const forbidden of [payload.title,payload.description,owner,'"description"','"requesterPersonId"'])assert.equal(encoded.includes(forbidden),false);
 await assert.rejects(observerQueue(pool,c,otherSchool),/OBSERVER_SCHOOL_REQUIRED/);await assert.rejects(observerQueue(pool,{...c,observerSchools:[]}),/OBSERVER_REQUIRED/);
 await assert.rejects(getTicket(pool,c,ticket.id),/TICKET_UNAVAILABLE/);await assert.rejects(getTicket(pool,c,ticket.id,true),/FOUNDER_REQUIRED/);
 }finally{await pool.query("DELETE FROM support.events WHERE ticket_id IN (SELECT id FROM support.tickets WHERE school_id=ANY($1::text[]))",[[schoolId,otherSchool]]);await pool.query("DELETE FROM support.tickets WHERE school_id=ANY($1::text[])",[[schoolId,otherSchool]]);await pool.query("DELETE FROM audit.product_audit_events WHERE actor_person_id=ANY($1::text[])",[[owner,personId]]);await pool.end();}
});
