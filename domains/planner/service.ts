import type {Pool,PoolClient} from "pg";
import {currentWeek,weekDate,PlannerError,type PlanInput} from "./contracts";
async function workspace(db:PoolClient,school:string,classId:string){
 const r=await db.query(`SELECT s.timezone FROM school_ops.school_workspaces s JOIN school_ops.class_workspaces c ON c.peos_school_id=s.peos_school_id
 WHERE s.peos_school_id=$1 AND c.peos_class_id=$2 AND s.status='ACTIVE' AND c.status='ACTIVE' FOR SHARE OF s,c`,[school,classId]);
 if(!r.rows[0])throw new PlannerError("CLASS_WORKSPACE_REQUIRED",409);return r.rows[0].timezone as string;
}
async function audit(db:PoolClient,actor:string,school:string,classId:string,action:string,metadata:unknown){
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
 VALUES(gen_random_uuid(),$1,$2,'WEEKLY_LESSON_PLAN',$3,$4,'ALLOW','current_peos_class_teacher',$5::jsonb,now())`,[actor,action,classId,school,JSON.stringify(metadata)]);
}
export async function readPlan(pool:Pool,actor:string,school:string,classId:string,week?:string){
 const db=await pool.connect();try{
  await db.query("BEGIN");const timezone=await workspace(db,school,classId);const day=weekDate.parse(week??currentWeek(timezone));
  const r=await db.query(`SELECT revision,lessons,updated_at AS "updatedAt" FROM learning.weekly_lesson_plans
   WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 AND week_start=$4`,[actor,school,classId,day]);
  await audit(db,actor,school,classId,"planner.read",{week:day,revision:r.rows[0]?.revision??0});await db.query("COMMIT");
  return {week:day,timezone,revision:r.rows[0]?.revision??0,lessons:r.rows[0]?.lessons??[],updatedAt:r.rows[0]?.updatedAt??null};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
export async function savePlan(pool:Pool,actor:string,school:string,classId:string,input:PlanInput){
 const db=await pool.connect();try{
  await db.query("BEGIN");await workspace(db,school,classId);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[JSON.stringify(["planner",actor,school,classId,input.week])]);
  const old=await db.query(`SELECT revision FROM learning.weekly_lesson_plans WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 AND week_start=$4 FOR UPDATE`,[actor,school,classId,input.week]);
  if((old.rows[0]?.revision??0)!==input.revision)throw new PlannerError("PLAN_CHANGED",409);
  const revision=input.revision+1;
  const saved=await db.query(`INSERT INTO learning.weekly_lesson_plans(teacher_person_id,peos_school_id,peos_class_id,week_start,lessons,revision)
   VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(teacher_person_id,peos_class_id,week_start)
   DO UPDATE SET lessons=excluded.lessons,revision=excluded.revision,updated_at=now() WHERE learning.weekly_lesson_plans.peos_school_id=excluded.peos_school_id`,[actor,school,classId,input.week,JSON.stringify(input.lessons),revision]);
  if(saved.rowCount!==1)throw new PlannerError("CLASS_WORKSPACE_REQUIRED",409);
  await audit(db,actor,school,classId,"planner.save",{week:input.week,revision,lessonCount:input.lessons.length});
  await db.query("COMMIT");return {saved:true,revision};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
