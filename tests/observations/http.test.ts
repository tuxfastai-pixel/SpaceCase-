import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {observationsHandler} from "../../platform/observations/http";
import {PlannerError} from "../../domains/planner/contracts";
import {AttendanceError} from "../../domains/attendance/contracts";
const actor=randomUUID(),schoolId=randomUUID(),classId=randomUUID(),recordId=randomUUID(),learnerId=randomUUID();
const params={schoolId,classId};
const body={action:"CREATE",recordId,learnerId,fields:{kind:"POSITIVE",observedDate:"2026-10-22",context:"Reading",evidence:"Read a page",response:"",nextStep:"",followUpDate:null}};
function req(method="GET",value:unknown=body,origin="https://school.example",signed=true){return new Request("https://school.example/api/observations",{method,headers:{origin,...(signed?{authorization:"Bearer scoped"}:{})},...(method==="POST"?{body:JSON.stringify(value)}:{})});}
test("observations enforce session, origin, strict input and current assignment before storage",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let writes=0,reads=0,rosters=0,revoked=false;
 const handler=observationsHandler({session:async()=>({personId:actor}),authority:async()=>{if(revoked)throw new PlannerError("CLASS_ACCESS_REQUIRED");return "Class";},roster:async()=>{rosters++;return {class:{id:classId,name:"Class",academicYear:2026},learners:[]};},read:async()=>{reads++;return {};},save:async(a,s,c,_r,i)=>{assert.deepEqual([a,s,c],[actor,schoolId,classId]);assert.deepEqual(i,body);writes++;return {saved:true};}});
 try{
  assert.equal((await handler(req("GET",body,undefined,false),params)).status,401);
  assert.equal((await handler(req("POST",body,"https://evil.example"),params)).status,403);
  assert.equal((await handler(req("POST",{...body,actor}),params)).status,400);assert.equal(rosters,0);
  assert.equal((await handler(req("POST"),params)).status,200);assert.equal(writes,1);
  const read=await handler(req(),params);assert.equal(read.headers.get("cache-control"),"no-store");assert.equal(read.status,200);assert.equal(reads,1);assert.equal(rosters,2);
  revoked=true;assert.equal((await handler(req("POST"),params)).status,403);assert.equal(writes,1);assert.equal(rosters,2);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("roster failure denies both observation reads and writes",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";const no=async()=>{throw new Error("must not reach storage");};
 const handler=observationsHandler({session:async()=>({personId:actor}),authority:async()=>"Class",roster:async()=>{throw new AttendanceError("PEOS_UNAVAILABLE",503);},read:no,save:no});
 try{for(const method of ["GET","POST"])assert.equal((await handler(req(method),params)).status,503);}finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("oversized observation bodies are rejected before authority and roster calls",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";const no=async()=>{throw new Error("must not reach external authority");};
 const handler=observationsHandler({session:async()=>({personId:actor}),authority:no,roster:no,read:no,save:no});
 try{assert.equal((await handler(req("POST",{padding:"x".repeat(50001)}),params)).status,400);}finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
