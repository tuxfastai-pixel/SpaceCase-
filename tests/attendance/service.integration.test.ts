import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";
import {Pool} from "pg";
import {attendanceInput,schoolDate,type AttendanceRoster} from "../../domains/attendance/contracts";
import {readAttendance,saveAttendance} from "../../domains/attendance/service";
import {configureWorkspace} from "../../domains/workspace/service";
test("attendance saves and corrects marks with audit, current roster bounds and concurrent-save protection",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const actor=randomUUID(),secondActor=randomUUID(),school=randomUUID(),classId=randomUUID(),first=randomUUID(),second=randomUUID();
 const roster:AttendanceRoster={class:{id:classId,name:"CI class",academicYear:2026},learners:[{personId:first,admissionNumber:"A001",givenName:"CI Lea",familyName:"Example"},{personId:second,admissionNumber:"A002",givenName:"CI Sam",familyName:"Example"}]};
 const today=schoolDate("Africa/Johannesburg");
 const input=(revision:number,firstStatus="PRESENT")=>attendanceInput.parse({date:today,revision,reason:revision?"CORRECTION":"INITIAL_REGISTER",entries:[{personId:first,status:firstStatus},{personId:second,status:"UNMARKED"}]});
 try{
  await configureWorkspace(pool,actor,school,[classId],{timezone:"Africa/Johannesburg",academicYearLabel:"2026"});
  const fresh=await readAttendance(pool,actor,school,classId,roster);assert.equal(fresh.date,today);assert.equal(fresh.revision,0);assert.deepEqual(fresh.learners.map(r=>r.status),["UNMARKED","UNMARKED"]);
  await assert.rejects(saveAttendance(pool,actor,school,classId,roster,attendanceInput.parse({...input(0),entries:[{personId:first,status:"ABSENT"}]})),/ROSTER_CHANGED/);
  await assert.rejects(saveAttendance(pool,actor,school,classId,roster,{...input(0),date:"2200-12-31"}),/FUTURE_DATE/);
  assert.equal((await saveAttendance(pool,actor,school,classId,roster,input(0))).revision,1);
  const saved=await readAttendance(pool,actor,school,classId,roster,today);assert.deepEqual(saved.learners.map(r=>r.status),["PRESENT","UNMARKED"]);assert.equal(saved.revision,1);
  // Two open copies of revision 1 cannot overwrite each other.
  const race=await Promise.allSettled([saveAttendance(pool,actor,school,classId,roster,input(1,"LATE")),saveAttendance(pool,secondActor,school,classId,roster,input(1,"ABSENT"))]);
  assert.equal(race.filter(r=>r.status==="fulfilled").length,1);assert.equal(race.filter(r=>r.status==="rejected").length,1);
  await assert.rejects(saveAttendance(pool,actor,school,classId,roster,input(1)),/REGISTER_CHANGED/);
  const after=await readAttendance(pool,actor,school,classId,roster,today);assert.equal(after.revision,2);
  const withoutFormer={...roster,learners:roster.learners.slice(0,1)};
  assert.equal((await readAttendance(pool,actor,school,classId,withoutFormer,today)).learners.length,1);
  assert.equal((await saveAttendance(pool,actor,school,classId,withoutFormer,{...input(2),entries:[{personId:first,status:"EXCUSED"}]})).revision,3);
  const retained=await pool.query("SELECT e.status FROM learning.attendance_entries e JOIN learning.attendance_registers r ON r.id=e.register_id WHERE r.peos_class_id=$1 AND e.learner_person_id=$2",[classId,second]);assert.equal(retained.rows[0].status,"UNMARKED");
  await assert.rejects(readAttendance(pool,actor,randomUUID(),classId,roster),/CLASS_WORKSPACE_REQUIRED/);
  const audits=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE resource_id=$1 AND action='attendance.save' ORDER BY occurred_at",[classId]);
  assert.equal(audits.rowCount,3);assert.equal(audits.rows[2].metadata.reason,"CORRECTION");assert.equal(audits.rows[2].metadata.changes[0].to,"EXCUSED");assert.equal(JSON.stringify(audits.rows).includes("CI Lea"),false);
 }finally{
  await pool.query("DELETE FROM learning.attendance_entries WHERE register_id IN (SELECT id FROM learning.attendance_registers WHERE peos_class_id=$1)",[classId]);
  await pool.query("DELETE FROM learning.attendance_registers WHERE peos_class_id=$1",[classId]);
  await pool.query("DELETE FROM school_ops.class_workspaces WHERE peos_class_id=$1",[classId]);
  await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[school]);
  await pool.query("DELETE FROM audit.product_audit_events WHERE school_id=$1",[school]);await pool.end();
 }
});
