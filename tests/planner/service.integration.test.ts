import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {configureWorkspace} from "../../domains/workspace/service";
import {readPlan,savePlan} from "../../domains/planner/service";
import {planInput} from "../../domains/planner/contracts";
test("weekly plans isolate teachers and classes, reject concurrent overwrites and audit without narrative",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const actor=randomUUID(),other=randomUUID(),school=randomUUID(),classId=randomUUID(),class2=randomUUID();
 const input=planInput.parse({week:"2026-10-19",revision:0,lessons:[{id:randomUUID(),date:"2026-10-21",subject:"Maths",topic:"Private topic",objectives:"Add",activities:"Count",resources:"",reflection:"",status:"READY"}]});
 try{
  await configureWorkspace(pool,actor,school,[classId,class2],{timezone:"Africa/Johannesburg",academicYearLabel:"2026"});
  assert.equal((await readPlan(pool,actor,school,classId,input.week)).revision,0);
  assert.equal((await savePlan(pool,actor,school,classId,input)).revision,1);
  assert.equal((await readPlan(pool,actor,school,classId,input.week)).lessons[0].topic,"Private topic");
  assert.deepEqual((await readPlan(pool,other,school,classId,input.week)).lessons,[]);
  assert.deepEqual((await readPlan(pool,actor,school,class2,input.week)).lessons,[]);
  const race=await Promise.allSettled([savePlan(pool,actor,school,classId,{...input,revision:1}),savePlan(pool,actor,school,classId,{...input,revision:1,lessons:[]})]);
  assert.equal(race.filter(r=>r.status==="fulfilled").length,1);assert.equal(race.filter(r=>r.status==="rejected").length,1);
  await assert.rejects(savePlan(pool,actor,school,classId,input),/PLAN_CHANGED/);
  await assert.rejects(readPlan(pool,actor,randomUUID(),classId,input.week),/CLASS_WORKSPACE_REQUIRED/);
  await savePlan(pool,other,school,classId,input);
  await pool.query("UPDATE school_ops.class_workspaces SET status='INACTIVE' WHERE peos_class_id=$1",[classId]);
  await assert.rejects(readPlan(pool,actor,school,classId,input.week),/CLASS_WORKSPACE_REQUIRED/);
  await assert.rejects(savePlan(pool,actor,school,classId,{...input,revision:2}),/CLASS_WORKSPACE_REQUIRED/);
  const a=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE school_id=$1 AND action='planner.save'",[school]);assert.equal(a.rowCount,3);assert.equal(JSON.stringify(a.rows).includes("Private topic"),false);
 }finally{
  await pool.query("DELETE FROM learning.weekly_lesson_plans WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM school_ops.class_workspaces WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[school]);await pool.query("DELETE FROM audit.product_audit_events WHERE school_id=$1",[school]);await pool.end();
 }
});
