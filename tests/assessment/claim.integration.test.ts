import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {configureWorkspace} from "../../domains/workspace/service";
import {createAssessment,type AssessmentScope} from "../../domains/assessment/service";
import {claimHandler} from "../../platform/assessment/claim";
test("execution permits are one-use, scope-bound and atomically limited across concurrent requests",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const s:AssessmentScope={actor:randomUUID(),school:randomUUID(),classId:randomUUID(),learnerIds:[randomUUID()]};const id=randomUUID(),subId=randomUUID(),first=randomUUID(),second=randomUUID();
 const keys=["PSG_AI_SERVICE_TOKEN","SPACECASE_ASSESSMENT_AI_ENABLED","SPACECASE_ASSESSMENT_AI_DAILY_LIMIT"] as const;const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const token="synthetic-test-token-at-least-32-characters";
 const body=(requestId:string)=>({requestId,actorPersonId:s.actor,schoolId:s.school,assessmentId:id,submissionRef:subId,sourceRevision:1,inputHash:"a".repeat(64),mode:"READ"});
 const handler=claimHandler(()=>pool);const request=(v:unknown)=>new Request("https://product.example/claim",{method:"POST",headers:{authorization:`Bearer ${token}`},body:JSON.stringify(v)});
 try{
  process.env.PSG_AI_SERVICE_TOKEN=token;process.env.SPACECASE_ASSESSMENT_AI_ENABLED="true";process.env.SPACECASE_ASSESSMENT_AI_DAILY_LIMIT="1";
  await configureWorkspace(pool,s.actor,s.school,[s.classId],{timezone:"Africa/Johannesburg",academicYearLabel:"2026"});await createAssessment(pool,s,{id,title:"Permit test",subject:"Maths",instructions:"",rubric:[{id:randomUUID(),label:"1",prompt:"1+1",expectedAnswer:"2",maxMarks:1}]});
  await pool.query("INSERT INTO assessment.submissions(id,assessment_id,learner_person_id,matching_confirmed) VALUES($1,$2,$3,true)",[subId,id,s.learnerIds[0]]);
  for(const job of [first,second])await pool.query("INSERT INTO assessment.ai_runs(id,submission_id,actor_person_id,source_revision,input_hash,status,purpose) VALUES($1,$2,$3,1,$4,'RUNNING','READ')",[job,subId,s.actor,"a".repeat(64)]);
  assert.equal((await handler(request({...body(first),actorPersonId:randomUUID()}))).status,409);
  const race=await Promise.all([handler(request(body(first))),handler(request(body(second)))]);assert.deepEqual(race.map(r=>r.status).sort(),[200,429]);
  const winner=race[0].status===200?first:second,loser=winner===first?second:first;assert.equal((await handler(request(body(winner)))).status,409);
  await pool.query("UPDATE assessment.ai_runs SET execution_claimed_at=now()-interval '25 hours' WHERE id=$1",[winner]);assert.equal((await handler(request(body(loser)))).status,200);
  await pool.query("UPDATE school_ops.class_workspaces SET status='INACTIVE' WHERE peos_class_id=$1",[s.classId]);assert.equal((await handler(request(body(first)))).status,409);
 }finally{
  for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
  await pool.query("DELETE FROM assessment.ai_runs WHERE submission_id=$1",[subId]);await pool.query("DELETE FROM assessment.submissions WHERE id=$1",[subId]);await pool.query("DELETE FROM assessment.assessments WHERE id=$1",[id]);await pool.query("DELETE FROM school_ops.class_workspaces WHERE peos_school_id=$1",[s.school]);await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[s.school]);await pool.query("DELETE FROM audit.product_audit_events WHERE school_id=$1",[s.school]);await pool.end();
 }
});
