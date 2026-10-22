import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {configureWorkspace} from "../../domains/workspace/service";
import {readHomework,saveHomework} from "../../domains/homework/service";
import {homeworkInput} from "../../domains/homework/contracts";
import type {AttendanceRoster} from "../../domains/attendance/contracts";
test("homework isolates ownership, protects revisions and preserves audited corrections and former learner records",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const actor=randomUUID(),other=randomUUID(),school=randomUUID(),classId=randomUUID(),otherClass=randomUUID(),taskId=randomUUID(),learner=randomUUID(),former=randomUUID();
 const roster:AttendanceRoster={class:{id:classId,name:"CI class",academicYear:2026},learners:[learner,former].map((personId,i)=>({personId,admissionNumber:`SC${i}`,givenName:"Test",familyName:"Learner"}))};
 const fields={title:"Private homework title",subject:"Maths",instructions:"Private instructions",assignedDate:"2026-10-22",dueDate:"2026-10-23"};
 const save=(v:unknown,r=roster)=>saveHomework(pool,actor,school,classId,homeworkInput.parse({taskId,...v as object}),r);
 try{
  await configureWorkspace(pool,actor,school,[classId,otherClass],{timezone:"Africa/Johannesburg",academicYearLabel:"2026"});
  await save({action:"CREATE",fields});
  await assert.rejects(save({action:"CREATE",fields}),/TASK_CHANGED/);
  await assert.rejects(saveHomework(pool,other,school,classId,homeworkInput.parse({action:"CLOSE",taskId,revision:1})),/TASK_NOT_FOUND/);
  await assert.rejects(saveHomework(pool,actor,school,otherClass,homeworkInput.parse({action:"CLOSE",taskId,revision:1})),/TASK_NOT_FOUND/);
  assert.equal((await readHomework(pool,other,school,classId)).tasks?.length,0);
  assert.equal((await readHomework(pool,actor,school,otherClass)).tasks?.length,0);
  await assert.rejects(readHomework(pool,other,school,classId,taskId,0,roster),/TASK_NOT_FOUND/);
  await assert.rejects(save({action:"COMPLETIONS",revision:1,reason:"INITIAL_RECORD",entries:[]}),/ASSIGNED_REQUIRED/);
  const races=await Promise.allSettled([save({action:"EDIT",revision:1,fields}),save({action:"EDIT",revision:1,fields:{...fields,title:"Other private title"}})]);
  assert.equal(races.filter(x=>x.status==="fulfilled").length,1);
  await save({action:"ASSIGN",revision:2});
  await assert.rejects(save({action:"EDIT",revision:3,fields}),/DRAFT_REQUIRED/);
  await assert.rejects(save({action:"COMPLETIONS",revision:3,reason:"INITIAL_RECORD",entries:[{personId:learner,status:"COMPLETED"}]}),/ROSTER_CHANGED/);
  await save({action:"COMPLETIONS",revision:3,reason:"INITIAL_RECORD",entries:[{personId:learner,status:"COMPLETED"},{personId:former,status:"EXCUSED"}]});
  await assert.rejects(save({action:"COMPLETIONS",revision:4,reason:"INITIAL_RECORD",entries:[{personId:learner,status:"INCOMPLETE"},{personId:former,status:"EXCUSED"}]}),/CORRECTION_REASON_REQUIRED/);
  const current={...roster,learners:roster.learners.slice(0,1)};
  await save({action:"COMPLETIONS",revision:4,reason:"CORRECTION",entries:[{personId:learner,status:"INCOMPLETE"}]},current);
  const detail=await readHomework(pool,actor,school,classId,taskId,0,current);
  assert.deepEqual(detail.task?.completions,{[learner]:"INCOMPLETE"});assert.equal(detail.history?.length,5);
  const retained=await pool.query("SELECT completions FROM learning.homework_tasks WHERE id=$1",[taskId]);assert.equal(retained.rows[0].completions[former],"EXCUSED");
  const event=await pool.query("SELECT metadata FROM learning.homework_events WHERE task_id=$1 AND revision=5",[taskId]);assert.equal(event.rows[0].metadata.changes[0].previous,"COMPLETED");
  await save({action:"CLOSE",revision:5});
  await assert.rejects(save({action:"COMPLETIONS",revision:6,reason:"CORRECTION",entries:[]}),/ASSIGNED_REQUIRED/);
  await save({action:"REOPEN",revision:6});
  await pool.query("UPDATE school_ops.class_workspaces SET status='INACTIVE' WHERE peos_class_id=$1",[classId]);
  await assert.rejects(save({action:"CLOSE",revision:7}),/CLASS_WORKSPACE_REQUIRED/);
  const audits=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE school_id=$1",[school]);assert.equal(JSON.stringify(audits.rows).includes("Private"),false);
 }finally{
  await pool.query("DELETE FROM learning.homework_events WHERE task_id=$1",[taskId]);await pool.query("DELETE FROM learning.homework_tasks WHERE id=$1",[taskId]);await pool.query("DELETE FROM school_ops.class_workspaces WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM audit.product_audit_events WHERE school_id=$1",[school]);await pool.end();
 }
});
