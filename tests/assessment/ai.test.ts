import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {assessmentAi} from "../../platform/assessment/ai";
test("AI adapter is disabled by default and sends only the scoped marking contract when configured",async()=>{
 const keys=["SPACECASE_ASSESSMENT_AI_ENABLED","PSG_AI_BASE_URL","PSG_AI_SERVICE_TOKEN"] as const;const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));let calls=0;
 const questionId=randomUUID(),pageId=randomUUID();const input={requestId:randomUUID(),actorPersonId:randomUUID(),schoolId:randomUUID(),assessmentId:randomUUID(),submissionId:randomUUID(),instructions:"Use the memorandum",rubric:[{id:questionId,label:"1",prompt:"1+1",expectedAnswer:"2",maxMarks:2}],pages:[{id:pageId,pageNumber:1,bytes:Buffer.from("test-image-only")}]};
 const gateway=assessmentAi((async(url,opts)=>{calls++;assert.equal(new URL(String(url)).pathname,"/v1/assessment-marking");assert.equal(opts?.redirect,"error");const body=JSON.parse(opts?.body as string);assert.equal(body.contractVersion,"spacecase.assessment-marking.v1");assert.equal(body.policy.teacherApprovalRequired,true);assert.equal(body.learnerPersonId,undefined);assert.equal(body.learnerName,undefined);return Response.json({executionId:"test-exec",modelRef:"test-model",policyVersion:"test-v1",items:[{questionId,marks:null,uncertain:true,feedback:"Unreadable",evidencePageIds:[]}],warnings:["Inspect the page"]});}) as typeof fetch);
 try{
  delete process.env.SPACECASE_ASSESSMENT_AI_ENABLED;await assert.rejects(gateway.propose(input),/AI_NOT_CONFIGURED/);assert.equal(calls,0);
  process.env.SPACECASE_ASSESSMENT_AI_ENABLED="true";process.env.PSG_AI_BASE_URL="https://ai.example";process.env.PSG_AI_SERVICE_TOKEN="test-token-not-real";
  assert.equal((await gateway.propose(input)).items[0].marks,null);assert.equal(calls,1);
 }finally{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});
