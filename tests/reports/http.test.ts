import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {reportsHandler} from '../../platform/reports/http';import {PlannerError} from '../../domains/planner/contracts';import {reportQuery} from '../../domains/reports/contracts';
const actor=randomUUID(),schoolId=randomUUID(),classId=randomUUID(),learnerId=randomUUID();
const roster={class:{id:classId,name:'Class',academicYear:2026},learners:[{personId:learnerId,givenName:'Synthetic',familyName:'Learner',admissionNumber:'TEST-001'}]};
const value={start:'2026-10-01',end:'2026-10-22',generatedOn:'2026-10-22',timezone:'Africa/Johannesburg',learner:roster.learners[0],attendance:{savedRegisters:0,present:0,absent:0,late:0,excused:0,unmarked:0},results:[],truncated:false};
const suffix=`?learnerId=${learnerId}&start=2026-10-01&end=2026-10-22`;
function request(query=suffix,signed=true){return new Request(`https://school.example/reports${query}`,{headers:signed?{authorization:'Bearer scoped'}:{}});}
test('report rechecks assignment and current learner roster before reading; never caches',async()=>{
 let reads=0,revoked=false;const handler=reportsHandler({session:async()=>({personId:actor}),authority:async()=>{if(revoked)throw new PlannerError('CLASS_ACCESS_REQUIRED');return 'Class';},roster:async()=>roster,read:async(a,s,c,r,q)=>{reads++;assert.deepEqual([a,s,c,q.learnerId],[actor,schoolId,classId,learnerId]);return value;}});
 const params={schoolId,classId};assert.equal((await handler(request(suffix,false),params)).status,401);
 for(const query of [suffix+'&teacherId=other',suffix+'&start=2026-10-01',suffix.replace(learnerId,randomUUID()),suffix.replace('2026-10-01','2026-11-01')]){assert.notEqual((await handler(request(query),params)).status,200);}assert.equal(reads,0);
 const list=await handler(request(''),params);assert.equal(list.status,200);assert.equal((await list.json()).learners.length,1);
 const result=await handler(request(),params);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(reads,1);
 revoked=true;assert.equal((await handler(request(),params)).status,403);assert.equal(reads,1);
});
test('unexpected private fields and inconsistent attendance fail closed',async()=>{
 for(const malformed of [{...value,privateNotes:'secret'},{...value,attendance:{...value.attendance,absent:1}}]){
  const handler=reportsHandler({session:async()=>({personId:actor}),authority:async()=> 'Class',roster:async()=>roster,read:async()=>malformed});const r=await handler(request(),{schoolId,classId});assert.equal(r.status,503);assert.equal((await r.text()).includes('secret'),false);
 }
 assert.equal(reportQuery.safeParse({learnerId,start:'2024-01-01',end:'2026-10-22'}).success,false);
 assert.equal(reportQuery.safeParse({learnerId,start:'2026-02-30',end:'2026-03-01'}).success,false);
});
