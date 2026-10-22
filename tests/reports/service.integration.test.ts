import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {configureWorkspace} from '../../domains/workspace/service';import {readProgressReport} from '../../domains/reports/service';
test('progress report isolates teacher/class/learner, current approved corrections and school dates',{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),actor=randomUUID(),other=randomUUID(),school=randomUUID(),classId=randomUUID(),learner=randomUUID(),former=randomUUID();
 const roster={class:{id:classId,name:'Class',academicYear:2026},learners:[{personId:learner,givenName:'Synthetic',familyName:'Learner',admissionNumber:'TEST-001'}]};
 const range={learnerId:learner,start:'2026-10-01',end:'2026-10-22'},now=new Date('2026-10-22T12:00:00Z');
 try{
  await configureWorkspace(pool,actor,school,[classId],{timezone:'Africa/Johannesburg',academicYearLabel:'2026'});
  for(const [date,status] of [['2026-10-01','PRESENT'],['2026-10-02','ABSENT'],['2026-10-03',null],['2026-09-30','ABSENT']] as const){const r=await pool.query(`INSERT INTO learning.attendance_registers(peos_school_id,peos_class_id,attendance_date,revision,updated_by) VALUES($1,$2,$3,1,$4) RETURNING id`,[school,classId,date,actor]);if(status)await pool.query(`INSERT INTO learning.attendance_entries(register_id,learner_person_id,status,updated_by) VALUES($1,$2,$3,$4)`,[r.rows[0].id,learner,status,actor]);}
  const assessment=async(owner:string,person:string,approved:string)=>{
   const id=randomUUID();await pool.query(`INSERT INTO assessment.assessments(id,teacher_person_id,peos_school_id,peos_class_id,title,subject,instructions,rubric,status) VALUES($1,$2,$3,$4,'Approved task','Maths','Private instructions','[{"id":"q1","maximum":10}]','OPEN')`,[id,owner,school,classId]);
   const sub=await pool.query(`INSERT INTO assessment.submissions(assessment_id,learner_person_id,proposal) VALUES($1,$2,'{"private":"AI suggestion"}') RETURNING id`,[id,person]);
   const r=await pool.query(`INSERT INTO assessment.results(submission_id,teacher_person_id,source_revision,scores,total,maximum,approved_at) VALUES($1,$2,1,'[]',6,10,$3) RETURNING id`,[sub.rows[0].id,owner,approved]);await pool.query('UPDATE assessment.submissions SET current_result_id=$2 WHERE id=$1',[sub.rows[0].id,r.rows[0].id]);return sub.rows[0].id;};
  const sub=await assessment(actor,learner,'2026-09-30T22:30:00Z');await assessment(other,learner,'2026-10-01T12:00Z');await assessment(actor,former,'2026-10-01T12:00Z');await assessment(actor,learner,'2026-10-22T22:30Z');
  let report=await readProgressReport(pool,actor,school,classId,roster,range,now);assert.deepEqual(report.attendance,{savedRegisters:3,present:1,absent:1,late:0,excused:0,unmarked:1});assert.equal(report.results.length,1);assert.equal(report.results[0].approvedOn,'2026-10-01');assert.equal(JSON.stringify(report).includes('Private'),false);assert.equal(JSON.stringify(report).includes('AI suggestion'),false);
  const correction=await pool.query(`INSERT INTO assessment.results(submission_id,teacher_person_id,source_revision,scores,total,maximum,approved_at) VALUES($1,$2,2,'[]',8,10,'2026-10-03T12:00Z') RETURNING id`,[sub,actor]);await pool.query('UPDATE assessment.submissions SET current_result_id=$2 WHERE id=$1',[sub,correction.rows[0].id]);
  report=await readProgressReport(pool,actor,school,classId,roster,range,now);assert.equal(report.results.length,1);assert.equal(report.results[0].total,8);assert.equal(report.results[0].approvedOn,'2026-10-03');
  await assert.rejects(readProgressReport(pool,actor,school,classId,roster,{...range,learnerId:former},now),/LEARNER_ACCESS_REQUIRED/);
  await assert.rejects(readProgressReport(pool,actor,school,classId,roster,{...range,end:'2026-10-23'},now),/FUTURE_REPORT_DATE/);
  await pool.query("UPDATE school_ops.class_workspaces SET status='INACTIVE' WHERE peos_class_id=$1",[classId]);await assert.rejects(readProgressReport(pool,actor,school,classId,roster,range,now),/CLASS_WORKSPACE_REQUIRED/);
  const audit=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE school_id=$1 AND action='learner_progress.read'",[school]);assert.equal(audit.rowCount,2);assert.ok(audit.rows.every(r=>!JSON.stringify(r.metadata).includes('Synthetic')));
 }finally{
  await pool.query('UPDATE assessment.submissions SET current_result_id=NULL WHERE assessment_id IN(SELECT id FROM assessment.assessments WHERE peos_school_id=$1)',[school]);
  await pool.query('DELETE FROM assessment.results WHERE submission_id IN(SELECT id FROM assessment.submissions WHERE assessment_id IN(SELECT id FROM assessment.assessments WHERE peos_school_id=$1))',[school]);
  await pool.query('DELETE FROM assessment.submissions WHERE assessment_id IN(SELECT id FROM assessment.assessments WHERE peos_school_id=$1)',[school]);await pool.query('DELETE FROM assessment.assessments WHERE peos_school_id=$1',[school]);
  await pool.query('DELETE FROM learning.attendance_entries WHERE register_id IN(SELECT id FROM learning.attendance_registers WHERE peos_school_id=$1)',[school]);await pool.query('DELETE FROM learning.attendance_registers WHERE peos_school_id=$1',[school]);
  await pool.query('DELETE FROM school_ops.class_workspaces WHERE peos_school_id=$1',[school]);await pool.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[school]);await pool.query('DELETE FROM audit.product_audit_events WHERE school_id=$1',[school]);await pool.end();
 }
});
