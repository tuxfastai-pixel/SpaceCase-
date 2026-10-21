import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {agentAction,founderWorkAction} from "../../domains/casework/contracts";
test("support agent actions cannot close cases, change priority or assign other staff",()=>{
 const input={ticketId:randomUUID(),requestId:randomUUID(),revision:0};
 assert.equal(agentAction.safeParse({...input,action:"CLAIM"}).success,true);
 assert.equal(agentAction.safeParse({...input,action:"REPLY",status:"UNDER_REVIEW",message:"Checking the issue"}).success,true);
 assert.equal(agentAction.safeParse({...input,action:"REPLY",status:"RESOLVED",message:"Closing"}).success,false);
 assert.equal(agentAction.safeParse({...input,action:"CLAIM",priority:"URGENT"}).success,false);
 assert.equal(agentAction.safeParse({...input,action:"ASSIGN",ownerPersonId:randomUUID(),reason:"Not permitted"}).success,false);
 assert.equal(founderWorkAction.safeParse({...input,action:"ASSIGN",ownerPersonId:null,reason:"Releasing for reassignment"}).success,true);
 assert.equal(agentAction.safeParse({...input,action:"ESCALATE",reason:""}).success,false);
});
