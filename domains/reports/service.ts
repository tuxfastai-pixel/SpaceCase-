import type {Pool} from 'pg';
import {schoolDate,type AttendanceRoster} from '../attendance/contracts';
import {ReportError,progressSchema,type ReportQuery} from './contracts';
export async function readProgressReport(pool:Pool,actor:string,school:string,classId:string,roster:AttendanceRoster,input:ReportQuery,now=new Date()){
 const learner=roster.learners.find(l=>l.personId===input.learnerId);
 if(roster.class.id!==classId||!learner)throw new ReportError('LEARNER_ACCESS_REQUIRED');
 const db=await pool.connect();try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await db.query("SET LOCAL statement_timeout='5000ms'");
  const workspace=await db.query(`SELECT s.timezone FROM school_ops.school_workspaces s JOIN school_ops.class_workspaces c ON c.peos_school_id=s.peos_school_id WHERE s.peos_school_id=$1 AND c.peos_class_id=$2 AND s.status='ACTIVE' AND c.status='ACTIVE' FOR SHARE OF s,c`,[school,classId]);
  if(!workspace.rows[0])throw new ReportError('CLASS_WORKSPACE_REQUIRED',409);
  const timezone=workspace.rows[0].timezone as string,generatedOn=schoolDate(timezone,now);
  if(input.end>generatedOn)throw new ReportError('FUTURE_REPORT_DATE',400);
  const attendance=await db.query(`SELECT count(*)::int AS "savedRegisters",
   count(*) FILTER(WHERE e.status='PRESENT')::int AS present,count(*) FILTER(WHERE e.status='ABSENT')::int AS absent,
   count(*) FILTER(WHERE e.status='LATE')::int AS late,count(*) FILTER(WHERE e.status='EXCUSED')::int AS excused,
   count(*) FILTER(WHERE e.status IS NULL OR e.status='UNMARKED')::int AS unmarked
   FROM learning.attendance_registers r LEFT JOIN learning.attendance_entries e ON e.register_id=r.id AND e.learner_person_id=$3
   WHERE r.peos_school_id=$1 AND r.peos_class_id=$2 AND r.revision>0 AND r.attendance_date BETWEEN $4::date AND $5::date`,[school,classId,input.learnerId,input.start,input.end]);
  const results=await db.query(`SELECT r.id,a.title,a.subject,(r.approved_at AT TIME ZONE $7)::date::text AS "approvedOn",r.total::float8 AS total,r.maximum
   FROM assessment.assessments a JOIN assessment.submissions s ON s.assessment_id=a.id JOIN assessment.results r ON r.id=s.current_result_id AND r.submission_id=s.id
   WHERE a.teacher_person_id=$1 AND a.peos_school_id=$2 AND a.peos_class_id=$3 AND s.learner_person_id=$4 AND r.teacher_person_id=$1
   AND r.approved_at >= ($5::date::timestamp AT TIME ZONE $7) AND r.approved_at < (($6::date+1)::timestamp AT TIME ZONE $7)
   ORDER BY r.approved_at,r.id LIMIT 201`,[actor,school,classId,input.learnerId,input.start,input.end,timezone]);
  const report=progressSchema.parse({start:input.start,end:input.end,generatedOn,timezone,learner,attendance:attendance.rows[0],results:results.rows.slice(0,200),truncated:results.rows.length>200});
  await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at) VALUES(gen_random_uuid(),$1,'learner_progress.read','LEARNER_PROGRESS',$2,$3,'ALLOW','current_peos_class_teacher',$4::jsonb,now())`,[actor,input.learnerId,school,JSON.stringify({classId,start:input.start,end:input.end})]);
  await db.query('COMMIT');return report;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
