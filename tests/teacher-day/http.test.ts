import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {teacherDayHandler} from "../../platform/teacher-day/http";
import {PlannerError} from "../../domains/planner/contracts";
import {AttendanceError} from "../../domains/attendance/contracts";
const actor=randomUUID(),schoolId=randomUUID(),classId=randomUUID();
const day={date:"2026-10-23",timezone:"Africa/Johannesburg",attendance:{saved:false,rosterCount:0,marked:0,unmarked:0,present:0,absent:0,late:0,excused:0},lessons:{total:0,items:[]},homework:{overdue:0,dueToday:0,upcoming:0,items:[]},assessments:{awaitingReview:0,unmatchedPhotos:0},followUps:{overdue:0,dueToday:0}};
const params={schoolId,classId};
function req(signed=true,path=""){return new Request(`https://school.example/api/day${path}`,{headers:signed?{authorization:"Bearer scoped"}:{}});}
test("daily overview rechecks current assignment and roster before storage and never caches",async()=>{
 let reads=0,rosters=0,revoked=false;
 const handler=teacherDayHandler({session:async()=>({personId:actor}),authority:async()=>{if(revoked)throw new PlannerError("CLASS_ACCESS_REQUIRED");return "Class";},roster:async()=>{rosters++;return {class:{id:classId,name:"Class",academicYear:2026},learners:[]};},read:async(a,s,c)=>{assert.deepEqual([a,s,c],[actor,schoolId,classId]);reads++;return day;}});
 assert.equal((await handler(req(false),params)).status,401);assert.equal(reads,0);
 assert.equal((await handler(req(true,"?teacherId=other"),params)).status,400);assert.equal(rosters,0);
 const result=await handler(req(),params);assert.equal(result.status,200);assert.equal(result.headers.get("cache-control"),"no-store");assert.equal((await result.json()).className,"Class");assert.equal(reads,1);
 revoked=true;assert.equal((await handler(req(),params)).status,403);assert.equal(reads,1);assert.equal(rosters,1);
});
test("roster failure or malformed summary returns unavailable instead of fabricated zero metrics",async()=>{
 let reads=0;const roster={class:{id:classId,name:"Class",academicYear:2026},learners:[]};
 const deps={session:async()=>({personId:actor}),authority:async()=>"Class",roster:async()=>roster,read:async()=>{reads++;return {...day,rawLearnerNames:["Private name"]};}};
 const malformed=await teacherDayHandler(deps)(req(),params);assert.equal(malformed.status,503);assert.equal(JSON.stringify(await malformed.json()).includes("Private"),false);
 const unavailable=await teacherDayHandler({...deps,roster:async()=>{throw new AttendanceError("PEOS_UNAVAILABLE",503);}})(req(),params);assert.equal(unavailable.status,503);assert.equal(reads,1);
});
