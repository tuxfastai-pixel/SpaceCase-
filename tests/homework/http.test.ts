import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {homeworkHandler} from "../../platform/homework/http";
import {PlannerError} from "../../domains/planner/contracts";
const actor=randomUUID(),schoolId=randomUUID(),classId=randomUUID(),taskId=randomUUID();
const params={schoolId,classId};const fields={title:"Task",subject:"Maths",instructions:"Count",assignedDate:"2026-10-22",dueDate:"2026-10-22"};
function req(method="GET",body:unknown={action:"CREATE",taskId,fields},origin="https://school.example",signed=true,url="https://school.example/api/homework"){return new Request(url,{method,headers:{origin,...(signed?{authorization:"Bearer scoped"}:{})},...(method==="POST"?{body:JSON.stringify(body)}:{})});}
test("homework checks session, origin, strict input and current authority before storage",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let writes=0,revoked=false,rosters=0;
 const handler=homeworkHandler({session:async()=>({personId:actor}),authority:async()=>{if(revoked)throw new PlannerError("CLASS_ACCESS_REQUIRED");return "Class";},roster:async()=>{rosters++;return {class:{id:classId,name:"Class",academicYear:2026},learners:[]};},read:async()=>({}),save:async(a,s,c)=>{assert.deepEqual([a,s,c],[actor,schoolId,classId]);writes++;return {saved:true};}});
 try{
  assert.equal((await handler(req("GET",{},undefined,false),params)).status,401);
  assert.equal((await handler(req("POST",{},"https://evil.example"),params)).status,403);
  assert.equal((await handler(req("POST",{action:"CREATE",taskId,fields,actor}),params)).status,400);
  assert.equal((await handler(req("POST"),params)).status,200);assert.equal(writes,1);assert.equal(rosters,0);
  assert.equal((await handler(req("GET",{},undefined,true,`https://school.example/api/homework?task=${taskId}`),params)).headers.get("cache-control"),"no-store");assert.equal(rosters,1);
  revoked=true;assert.equal((await handler(req("POST"),params)).status,403);assert.equal(writes,1);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("homework rejects oversized streaming input and invalid pagination without reading storage",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";
 const no=async()=>{throw new Error("must not access storage");};const handler=homeworkHandler({session:async()=>({personId:actor}),authority:no,roster:no,read:no,save:no});
 try{
  assert.equal((await handler(req("POST",{padding:"x".repeat(150001)}),params)).status,400);
  assert.equal((await handler(req("GET",{},undefined,true,"https://school.example/api/homework?offset=-1"),params)).status,400);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
