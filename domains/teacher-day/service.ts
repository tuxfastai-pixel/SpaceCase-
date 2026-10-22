import type {Pool} from "pg";
import {schoolDate,type AttendanceRoster} from "../attendance/contracts";
import {addDays,monday,lessonSchema} from "../planner/contracts";
import {TeacherDayError,type TeacherDay} from "./contracts";
export async function readTeacherDay(pool:Pool,actor:string,school:string,classId:string,roster:AttendanceRoster,now=new Date()):Promise<Omit<TeacherDay,"className">>{
 if(roster.class.id!==classId||new Set(roster.learners.map(l=>l.personId)).size!==roster.learners.length)throw new TeacherDayError("ROSTER_CHANGED",409);
 const db=await pool.connect();try{
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ");await db.query("SET LOCAL statement_timeout='5000ms'");
  const workspace=await db.query(`SELECT s.timezone FROM school_ops.school_workspaces s JOIN school_ops.class_workspaces c ON c.peos_school_id=s.peos_school_id
   WHERE s.peos_school_id=$1 AND c.peos_class_id=$2 AND s.status='ACTIVE' AND c.status='ACTIVE' FOR SHARE OF s,c`,[school,classId]);
  if(!workspace.rows[0])throw new TeacherDayError("CLASS_WORKSPACE_REQUIRED",409);
  const timezone=workspace.rows[0].timezone as string,date=schoolDate(timezone,now),ids=roster.learners.map(l=>l.personId);
  const register=await db.query(`SELECT id,revision FROM learning.attendance_registers WHERE peos_school_id=$1 AND peos_class_id=$2 AND attendance_date=$3`,[school,classId,date]);
  const attendance={saved:Boolean(register.rows[0]?.revision),rosterCount:ids.length,marked:0,unmarked:ids.length,present:0,absent:0,late:0,excused:0};
  if(register.rows[0]){
   const entries=await db.query(`SELECT status,count(*)::int AS count FROM learning.attendance_entries WHERE register_id=$1 AND learner_person_id=ANY($2::text[]) GROUP BY status`,[register.rows[0].id,ids]);
   for(const row of entries.rows){if(row.status==="PRESENT")attendance.present=row.count;if(row.status==="ABSENT")attendance.absent=row.count;if(row.status==="LATE")attendance.late=row.count;if(row.status==="EXCUSED")attendance.excused=row.count;}
   attendance.marked=attendance.present+attendance.absent+attendance.late+attendance.excused;attendance.unmarked=ids.length-attendance.marked;
  }
  const plan=await db.query(`SELECT lessons FROM learning.weekly_lesson_plans WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 AND week_start=$4`,[actor,school,classId,monday(date)]);
  const lessons=(plan.rows[0]?.lessons??[]).map((v:unknown)=>lessonSchema.parse(v)).filter((v:{date:string})=>v.date===date);
  const homeworkCounts=await db.query(`SELECT count(*) FILTER(WHERE due_date<$4)::int AS overdue,count(*) FILTER(WHERE due_date=$4)::int AS "dueToday",
   count(*) FILTER(WHERE due_date>$4 AND due_date<=$5)::int AS upcoming FROM learning.homework_tasks WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 AND state='ASSIGNED'`,[actor,school,classId,date,addDays(date,7)]);
  const homeworkItems=await db.query(`SELECT id,title,subject,due_date::text AS "dueDate" FROM learning.homework_tasks WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 AND state='ASSIGNED' AND due_date<=$4 ORDER BY due_date,id LIMIT 5`,[actor,school,classId,addDays(date,7)]);
  const assessments=await db.query(`SELECT
   (SELECT count(*)::int FROM assessment.submissions s JOIN assessment.assessments a ON a.id=s.assessment_id
    WHERE a.teacher_person_id=$1 AND a.peos_school_id=$2 AND a.peos_class_id=$3 AND a.status='OPEN' AND s.learner_person_id=ANY($4::text[]) AND s.current_result_id IS NULL
    AND EXISTS(SELECT 1 FROM assessment.pages p WHERE p.submission_id=s.id AND p.assessment_id=a.id AND p.removed_at IS NULL AND p.upload_complete)) AS "awaitingReview",
   (SELECT count(*)::int FROM assessment.pages p JOIN assessment.assessments a ON a.id=p.assessment_id
    WHERE a.teacher_person_id=$1 AND a.peos_school_id=$2 AND a.peos_class_id=$3 AND a.status='OPEN' AND p.submission_id IS NULL AND p.removed_at IS NULL AND p.upload_complete) AS "unmatchedPhotos"`,[actor,school,classId,ids]);
  const followUps=await db.query(`SELECT count(*) FILTER(WHERE follow_up_date<$5)::int AS overdue,count(*) FILTER(WHERE follow_up_date=$5)::int AS "dueToday"
   FROM learning.classroom_observations WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 AND learner_person_id=ANY($4::text[]) AND state='OPEN'`,[actor,school,classId,ids,date]);
  await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
   VALUES(gen_random_uuid(),$1,'teacher_day.read','TEACHER_DAY',$2,$3,'ALLOW','current_peos_class_teacher',$4::jsonb,now())`,[actor,classId,school,JSON.stringify({date})]);
  await db.query("COMMIT");
  return {date,timezone,attendance,lessons:{total:lessons.length,items:lessons.slice(0,10).map((l:{id:string;subject:string;topic:string;status:"DRAFT"|"READY"|"TAUGHT"})=>({id:l.id,subject:l.subject,topic:l.topic,status:l.status}))},homework:{...homeworkCounts.rows[0],items:homeworkItems.rows},assessments:assessments.rows[0],followUps:followUps.rows[0]};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
