import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";
import {AttendanceError,type AttendanceRoster} from "../../domains/attendance/contracts";
import {attendanceHandler} from "../../platform/attendance/http";
const schoolId=randomUUID(),classId=randomUUID(),personId=randomUUID();
const roster:AttendanceRoster={class:{id:classId,name:"Grade 2C",academicYear:2026},learners:[{personId,admissionNumber:"A001",givenName:"Lea",familyName:"Example"}]};
const body={date:"2026-10-19",revision:0,reason:"INITIAL_REGISTER",entries:[{personId,status:"PRESENT"}]};
function req(method="GET",value:unknown=body,origin="https://school.example",signed=true){return new Request("https://school.example/api/attendance",{method,headers:{origin,...(signed?{authorization:"Bearer scoped"}:{})},...(method==="GET"?{}:{body:JSON.stringify(value)})});}
test("attendance rejects missing session and cross-origin writes before querying records",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let calls=0;
 const handler=attendanceHandler({session:async()=>{calls++;return null;},roster:async()=>{throw new Error("must not query");},read:async()=>{},save:async()=>{}});
 try{
  assert.equal((await handler(req("PUT",body,"https://other.example"),{schoolId,classId})).status,403);assert.equal(calls,0);
  assert.equal((await handler(req("GET",body,undefined,false),{schoolId,classId})).status,401);assert.equal(calls,0);
  assert.equal((await handler(req(),{schoolId,classId})).status,401);assert.equal(calls,1);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("attendance rechecks teacher roster on every read and save and exposes only validated entries",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let rosterCalls=0,saveCalls=0;let revoked=false;
 const handler=attendanceHandler({session:async()=>({personId:"teacher"}),roster:async()=>{rosterCalls++;if(revoked)throw new AttendanceError("CLASS_ACCESS_REQUIRED");return roster;},read:async()=>({learners:[]}),save:async(actor,school,cl,current,input)=>{saveCalls++;assert.equal(actor,"teacher");assert.equal(school,schoolId);assert.equal(cl,classId);assert.equal(current,roster);assert.deepEqual(input.entries,body.entries);return {saved:true};}});
 try{
  const read=await handler(req(),{schoolId,classId});assert.equal(read.status,200);assert.equal(read.headers.get("cache-control"),"no-store");
  assert.equal((await handler(req("PUT"),{schoolId,classId})).status,200);assert.equal(rosterCalls,2);assert.equal(saveCalls,1);
  revoked=true;assert.equal((await handler(req("PUT"),{schoolId,classId})).status,403);assert.equal(saveCalls,1);
  const invalid=await handler(req("PUT",{...body,entries:[{personId,status:"PRESENT",notes:"unnecessary"}]}),{schoolId,classId});assert.equal(invalid.status,400);assert.equal(rosterCalls,3);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("malformed upstream session and roster payloads return dependency failure rather than invalid input",async()=>{
 const {z}=await import("zod");
 const schemaFailure=():never=>{z.string().parse(null);throw new Error("Expected a schema error");};
 for(const stage of ["session","roster"]){
  for(const failure of [()=>{throw new SyntaxError("upstream JSON");},schemaFailure]){
   const handler=attendanceHandler({session:async()=>stage==="session"?failure():{personId:"teacher"},roster:async()=>failure(),read:async()=>{throw new Error("must not read");},save:async()=>{throw new Error("must not write");}});
   const response=await handler(req(),{schoolId,classId});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:"PEOS_UNAVAILABLE"});
  }
 }
});
