import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {assertFounder,assertMember,ticketInput,recommendationInput,decisionInput} from "../../domains/support/contracts";
const school=randomUUID();const input={requestId:randomUUID(),schoolId:school,category:"BUG",impact:"DEGRADED",area:"ATTENDANCE",title:"Save does not finish",description:"The register save did not complete as expected."};
test("support submissions accept only bounded explicit feedback and school authority",()=>{
 assert.equal(ticketInput.safeParse(input).success,true);
 for(const extra of [{learnerId:randomUUID()},{founder:true},{screenshot:"https://private.example"},{status:"RESOLVED"}])assert.equal(ticketInput.safeParse({...input,...extra}).success,false);
 assert.equal(ticketInput.safeParse({...input,description:"x".repeat(4001)}).success,false);
 const c={personId:randomUUID(),founder:false,schools:[{id:school,displayName:"School"}]};
 assert.doesNotThrow(()=>assertMember(c,school));assert.throws(()=>assertMember(c,randomUUID()),/SCHOOL_ACCESS_REQUIRED/);assert.throws(()=>assertFounder(c),/FOUNDER_REQUIRED/);
});
test("recommendations bound decision evidence and never accept execution commands",()=>{
 const proposal={ticketId:randomUUID(),summary:"A bounded proposed fix",benefit:"Fewer failed saves",risks:"Requires release verification",validation:"Tests passed on the isolated candidate",rollback:"Revert the application deployment",changeUrl:"https://github.com/tuxfastai-pixel/SpaceCase-/pull/1"};
 assert.equal(recommendationInput.safeParse(proposal).success,true);
 for(const url of ["javascript:alert(1)","https://github.com.evil.example/tuxfastai-pixel/SpaceCase-/pull/1","https://user@github.com/tuxfastai-pixel/SpaceCase-/pull/1","https://github.com/other/repo/pull/1"])assert.equal(recommendationInput.safeParse({...proposal,changeUrl:url}).success,false);
 assert.equal(decisionInput.safeParse({proposalId:randomUUID(),decision:"DEPLOY",reason:"Run deployment"}).success,false);
 assert.equal(decisionInput.safeParse({proposalId:randomUUID(),decision:"APPROVED",reason:"Reviewed the evidence",execute:true}).success,false);
});
