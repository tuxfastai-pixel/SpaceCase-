import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {classAuthority,plannerHandler} from "../../platform/planner/http";
import {PlannerError} from "../../domains/planner/contracts";
const actor=randomUUID(),schoolId=randomUUID(),classId=randomUUID();
const body={week:"2026-10-19",revision:0,lessons:[]};
function req(method="GET",value:unknown=body,signed=true,origin="https://school.example"){return new Request("https://school.example/api/planner",{method,headers:{origin,...(signed?{authorization:"Bearer scoped"}:{})},...(method==="GET"?{}:{body:JSON.stringify(value)})});}
test("planner rejects unsigned, cross-origin and malformed writes; rechecks revocation",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let calls=0,writes=0,revoked=false;
 const handler=plannerHandler({session:async()=>({personId:actor}),authority:async()=>{calls++;if(revoked)throw new PlannerError("CLASS_ACCESS_REQUIRED");return "Class";},read:async()=>({}),save:async(a,s,c,i)=>{writes++;assert.equal(a,actor);assert.equal(s,schoolId);assert.equal(c,classId);assert.deepEqual(i,body);return {saved:true};}});
 try{
  assert.equal((await handler(req("GET",body,false),{schoolId,classId})).status,401);
  assert.equal((await handler(req("PUT",body,true,"https://other.example"),{schoolId,classId})).status,403);
  assert.equal((await handler(req("PUT",{...body,teacherPersonId:randomUUID()}),{schoolId,classId})).status,400);assert.equal(calls,0);
  const read=await handler(req(),{schoolId,classId});assert.equal(read.status,200);assert.equal(read.headers.get("cache-control"),"no-store");
  assert.equal((await handler(req("PUT"),{schoolId,classId})).status,200);assert.equal(writes,1);
  revoked=true;assert.equal((await handler(req("PUT"),{schoolId,classId})).status,403);assert.equal(calls,3);assert.equal(writes,1);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("class authority checks person, school, assignment and active state without learner data",async()=>{
 const base={personId:actor,schoolId,classIds:[classId],active:true,classes:[{id:classId,name:"Grade 2C"}]};
 const fetcher=(v:unknown)=>(async(_u:unknown,options?:RequestInit)=>{assert.equal(options?.cache,"no-store");return Response.json(v);}) as typeof fetch;
 assert.equal(await classAuthority("https://peos.example","Bearer scoped",actor,schoolId,classId,fetcher(base)),"Grade 2C");
 for(const value of [{...base,personId:randomUUID()},{...base,schoolId:randomUUID()},{...base,classIds:[]},{...base,active:false}])await assert.rejects(classAuthority("https://peos.example","Bearer scoped",actor,schoolId,classId,fetcher(value)),/CLASS_ACCESS_REQUIRED/);
 await assert.rejects(classAuthority("https://peos.example","Bearer scoped",actor,schoolId,classId,fetcher({})),/PEOS_UNAVAILABLE/);
});
