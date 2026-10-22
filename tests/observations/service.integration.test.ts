import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {configureWorkspace} from "../../domains/workspace/service";
import {readObservations,saveObservation} from "../../domains/observations/service";
import {observationInput,observationQuery} from "../../domains/observations/contracts";
import {schoolDate,type AttendanceRoster} from "../../domains/attendance/contracts";
type ReadResult=Awaited<ReturnType<typeof readObservations>>;
function asList(value:ReadResult){assert.ok("records" in value);return value;}
function asDetail(value:ReadResult){assert.ok("record" in value);return value;}
const enabled=Boolean(process.env.CI&&process.env.DATABASE_URL);
async function cleanup(pool:Pool,school:string){
 await pool.query("DELETE FROM learning.observation_revisions WHERE observation_id IN(SELECT id FROM learning.classroom_observations WHERE peos_school_id=$1)",[school]);await pool.query("DELETE FROM learning.classroom_observations WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM school_ops.class_workspaces WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM audit.product_audit_events WHERE school_id=$1",[school]);await pool.end();
}
test("observations enforce ownership, current roster, concurrent revisions and immutable correction snapshots",{skip:!enabled},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const actor=randomUUID(),other=randomUUID(),school=randomUUID(),classId=randomUUID(),otherClass=randomUUID(),recordId=randomUUID(),learner=randomUUID(),former=randomUUID();
 const roster:AttendanceRoster={class:{id:classId,name:"CI class",academicYear:2026},learners:[learner,former].map((personId,i)=>({personId,admissionNumber:`SC${i}`,givenName:"Private name",familyName:"Learner"}))};
 const fields={kind:"BEHAVIOUR_SUPPORT",observedDate:schoolDate("Africa/Johannesburg"),context:"Private classroom context",evidence:"Private factual evidence",response:"Offered a pause",nextStep:"Check in",followUpDate:null};
 const save=(value:object,r=roster)=>saveObservation(pool,actor,school,classId,r,observationInput.parse({recordId,...value}));
 const read=(value:object={},r=roster)=>readObservations(pool,actor,school,classId,r,observationQuery.parse(value));
 try{
  await configureWorkspace(pool,actor,school,[classId,otherClass],{timezone:"Africa/Johannesburg",academicYearLabel:"2026"});
  await assert.rejects(save({action:"CREATE",learnerId:randomUUID(),fields}),/LEARNER_NOT_IN_CLASS/);
  await assert.rejects(save({action:"CREATE",learnerId:learner,fields:{...fields,observedDate:"2200-12-31"}}),/FUTURE_OBSERVATION_DATE/);
  await save({action:"CREATE",learnerId:learner,fields});
  await assert.rejects(save({action:"CREATE",learnerId:learner,fields}),/RECORD_CHANGED/);
  assert.equal(asList(await readObservations(pool,other,school,classId,roster,observationQuery.parse({}))).records?.length,0);
  await assert.rejects(readObservations(pool,other,school,classId,roster,observationQuery.parse({record:recordId})),/RECORD_NOT_FOUND/);
  const foreign={...roster,class:{...roster.class,id:otherClass}};
  await assert.rejects(readObservations(pool,actor,school,otherClass,foreign,observationQuery.parse({record:recordId})),/RECORD_NOT_FOUND/);
  await assert.rejects(saveObservation(pool,other,school,classId,roster,observationInput.parse({action:"RESOLVE",recordId,revision:1,outcome:"Done"})),/RECORD_NOT_FOUND/);
  const race=await Promise.allSettled([save({action:"EDIT",revision:1,reason:"ENTRY_CORRECTION",fields:{...fields,evidence:"Corrected evidence"}}),save({action:"EDIT",revision:1,reason:"NEW_INFORMATION",fields:{...fields,evidence:"Updated evidence"}})]);
  assert.equal(race.filter(x=>x.status==="fulfilled").length,1);assert.equal(race.filter(x=>x.status==="rejected").length,1);
  const original=await pool.query("SELECT snapshot FROM learning.observation_revisions WHERE observation_id=$1 AND revision=1",[recordId]);assert.equal(original.rows[0].snapshot.evidence,fields.evidence);
  await save({action:"RESOLVE",revision:2,outcome:"Teacher reviewed progress"});
  await assert.rejects(save({action:"EDIT",revision:3,reason:"FOLLOW_UP",fields}),/OPEN_RECORD_REQUIRED/);
  await save({action:"REOPEN",revision:3,reason:"FOLLOW_UP"});assert.equal(asDetail(await read({record:recordId})).record?.outcome,"");
  const resolved=await pool.query("SELECT snapshot FROM learning.observation_revisions WHERE observation_id=$1 AND revision=3",[recordId]);assert.equal(resolved.rows[0].snapshot.outcome,"Teacher reviewed progress");
  const without={...roster,learners:roster.learners.slice(1)};
  assert.equal(asList(await read({},without)).records?.length,0);await assert.rejects(read({record:recordId},without),/RECORD_NOT_FOUND/);
  await assert.rejects(save({action:"RETRACT",revision:4,reason:"ENTRY_ERROR"},without),/RECORD_NOT_FOUND/);
  await save({action:"RETRACT",revision:4,reason:"ENTRY_ERROR"});
  await assert.rejects(save({action:"REOPEN",revision:5,reason:"FOLLOW_UP"}),/RECORD_RETRACTED/);
  const detail=asDetail(await read({record:recordId}));assert.equal(detail.record?.state,"RETRACTED");assert.equal(detail.history?.length,5);assert.equal(JSON.stringify(detail.history).includes("Private"),false);
  const audits=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE school_id=$1",[school]);assert.equal(JSON.stringify(audits.rows).includes("Private"),false);
  await pool.query("UPDATE school_ops.class_workspaces SET status='INACTIVE' WHERE peos_class_id=$1",[classId]);await assert.rejects(read(),/CLASS_WORKSPACE_REQUIRED/);
 }finally{await cleanup(pool,school);}
});
test("observation pagination and state filters exclude former learners before applying limits",{skip:!enabled},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const actor=randomUUID(),school=randomUUID(),classId=randomUUID(),learner=randomUUID(),former=randomUUID();
 const roster:AttendanceRoster={class:{id:classId,name:"CI class",academicYear:2026},learners:[{personId:learner,admissionNumber:"SC1",givenName:"Test",familyName:"Learner"}]};
 try{
  await configureWorkspace(pool,actor,school,[classId],{timezone:"UTC",academicYearLabel:"2026"});
  await pool.query(`INSERT INTO learning.classroom_observations(id,teacher_person_id,peos_school_id,peos_class_id,learner_person_id,kind,observed_date,context,evidence)
   SELECT gen_random_uuid(),$1,$2,$3,CASE WHEN i<=52 THEN $4 ELSE $5 END,'POSITIVE',current_date,'Reading','Observed work' FROM generate_series(1,60) i`,[actor,school,classId,learner,former]);
  const first=asList(await readObservations(pool,actor,school,classId,roster,observationQuery.parse({state:"OPEN"})));assert.equal(first.records?.length,50);assert.equal(first.nextOffset,50);assert.ok(first.records?.every(r=>r.learnerId===learner));
  const second=asList(await readObservations(pool,actor,school,classId,roster,observationQuery.parse({offset:50})));assert.equal(second.records?.length,2);assert.equal(second.nextOffset,null);
  const closed=asList(await readObservations(pool,actor,school,classId,roster,observationQuery.parse({state:"RESOLVED"})));assert.equal(closed.records?.length,0);
  await assert.rejects(readObservations(pool,actor,school,classId,roster,observationQuery.parse({learner:former})),/LEARNER_NOT_IN_CLASS/);
 }finally{await cleanup(pool,school);}
});
