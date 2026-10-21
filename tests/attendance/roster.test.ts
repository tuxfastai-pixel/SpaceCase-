import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";
import {loadAttendanceRoster} from "../../platform/attendance/roster";
const school=randomUUID(),classId=randomUUID();const classroom={id:classId,name:"Grade 2C",academicYear:2026};
const learner=()=>({personId:randomUUID(),admissionNumber:"A001",givenName:"Lea",familyName:"Example"});
test("attendance loads every roster page through current PEOS teacher authorization",async()=>{
 const rows=Array.from({length:101},learner);const urls:string[]=[];
 const fetcher=(async(url:URL|RequestInfo,init?:RequestInit)=>{urls.push(String(url));assert.equal((init?.headers as Record<string,string>).authorization,"Bearer scoped");assert.equal(init?.cache,"no-store");const second=String(url).endsWith("offset=100");return Response.json({class:classroom,learners:second?rows.slice(100):rows.slice(0,100),nextOffset:second?null:100});}) as typeof fetch;
 const roster=await loadAttendanceRoster("https://peos.example","Bearer scoped",school,classId,fetcher);assert.equal(roster.learners.length,101);assert.equal(urls.length,2);
});
test("revoked, malformed, duplicate, mismatched and incomplete roster responses fail closed",async()=>{
 const same=learner();
 for(const response of [Response.json({error:"DENIED"},{status:403}),Response.json({class:{...classroom,id:randomUUID()},learners:[],nextOffset:null}),Response.json({class:classroom,learners:[same,same],nextOffset:null}),Response.json({class:classroom,learners:[same],nextOffset:100}),Response.json({learners:[]})]){
  await assert.rejects(loadAttendanceRoster("https://peos.example","Bearer scoped",school,classId,(async()=>response) as typeof fetch));
 }
});
