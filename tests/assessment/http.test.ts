import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {assessmentHandler,type Authority} from "../../platform/assessment/http";
import {AssessmentError} from "../../domains/assessment/contracts";
const schoolId=randomUUID(),classId=randomUUID(),assessmentId=randomUUID(),actor=randomUUID();
const auth:Authority={scope:{actor,school:schoolId,classId,learnerIds:[]},className:"Class",learners:[]};
function request(method="GET",body?:unknown,signed=true,origin="https://school.example"){return new Request("https://school.example/api/assessments",{method,headers:{origin,...(signed?{authorization:"Bearer scoped"}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
test("assessment HTTP denies unsigned, cross-origin and forged bodies before storage",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let calls=0;
 const handler=assessmentHandler({authority:async()=>{calls++;return auth;},pool:()=>{throw new Error("Must not create pool");},store:()=>{throw new Error("Must not create storage client");},ai:()=>{throw new Error("Must not call AI");},storageReady:()=>false,aiReady:()=>false});
 try{
  assert.equal((await handler(request("GET",undefined,false),{schoolId,classId})).status,401);
  assert.equal((await handler(request("POST",{},true,"https://other.example"),{schoolId,classId})).status,403);
  assert.equal((await handler(request("POST",{action:"APPROVE",submissionId:randomUUID(),revision:1,acknowledged:true,marks:100}),{schoolId,classId,assessmentId})).status,400);assert.equal(calls,0);
  const response=await handler(request("POST",{action:"ASSIST",submissionId:randomUUID(),revision:1,requestId:randomUUID(),acknowledged:true}),{schoolId,classId,assessmentId});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:"AI_NOT_CONFIGURED"});assert.equal(response.headers.get("cache-control"),"private, no-store");
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("revocation stops photo access before reading from storage",async()=>{
 const handler=assessmentHandler({authority:async()=>{throw new AssessmentError("CLASS_ACCESS_REQUIRED");},pool:()=>{throw new Error("No DB");},store:()=>{throw new Error("No photos");},ai:()=>{throw new Error("No AI");},storageReady:()=>true,aiReady:()=>true});
 const r=await handler(request(),{schoolId,classId,assessmentId,pageId:randomUUID()});assert.equal(r.status,403);
});
