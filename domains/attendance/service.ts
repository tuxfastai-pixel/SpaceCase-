import type {Pool,PoolClient} from "pg";
import {AttendanceError,attendanceDate,assertRosterEntries,schoolDate,type AttendanceInput,type AttendanceRoster,type AttendanceStatus} from "./contracts";
async function workspace(db:PoolClient,schoolId:string,classId:string){
 const result=await db.query(`SELECT s.timezone FROM school_ops.school_workspaces s JOIN school_ops.class_workspaces c ON c.peos_school_id=s.peos_school_id
   WHERE s.peos_school_id=$1 AND c.peos_class_id=$2 AND s.status='ACTIVE' AND c.status='ACTIVE' FOR SHARE OF s,c`,[schoolId,classId]);
 if(!result.rows[0]?.timezone)throw new AttendanceError("CLASS_WORKSPACE_REQUIRED",409);
 return result.rows[0].timezone as string;
}
async function audit(db:PoolClient,actor:string,schoolId:string,classId:string,action:string,metadata:unknown){
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
  VALUES(gen_random_uuid(),$1,$2,'CLASS_ATTENDANCE',$3,$4,'ALLOW','current_peos_class_teacher',$5::jsonb,now())`,[actor,action,classId,schoolId,JSON.stringify(metadata)]);
}
export async function readAttendance(pool:Pool,actor:string,schoolId:string,classId:string,roster:AttendanceRoster,date?:string){
 if(roster.class.id!==classId)throw new AttendanceError("CLASS_ACCESS_REQUIRED");
 const db=await pool.connect();try{
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  const timezone=await workspace(db,schoolId,classId);const today=schoolDate(timezone);const day=attendanceDate.parse(date??today);
  if(day>today)throw new AttendanceError("FUTURE_DATE",400);
  const register=await db.query(`SELECT id,revision,updated_at AS "updatedAt" FROM learning.attendance_registers WHERE peos_school_id=$1 AND peos_class_id=$2 AND attendance_date=$3`,[schoolId,classId,day]);
  const current=register.rows[0];const entries=current?await db.query("SELECT learner_person_id,status FROM learning.attendance_entries WHERE register_id=$1",[current.id]):{rows:[]};
  const marks=new Map<string,AttendanceStatus>(entries.rows.map(r=>[r.learner_person_id,r.status]));
  const learners=roster.learners.map(r=>({...r,status:marks.get(r.personId)??"UNMARKED"}));
  await audit(db,actor,schoolId,classId,"attendance.read",{date:day,revision:current?.revision??0,learnerCount:learners.length});
  await db.query("COMMIT");return {class:roster.class,date:day,today,timezone,revision:current?.revision??0,updatedAt:current?.updatedAt??null,learners};
 }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}
export async function saveAttendance(pool:Pool,actor:string,schoolId:string,classId:string,roster:AttendanceRoster,input:AttendanceInput){
 if(roster.class.id!==classId)throw new AttendanceError("CLASS_ACCESS_REQUIRED");
 assertRosterEntries(roster,input);const db=await pool.connect();try{
  await db.query("BEGIN");const timezone=await workspace(db,schoolId,classId);
  if(input.date>schoolDate(timezone))throw new AttendanceError("FUTURE_DATE",400);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[JSON.stringify(["attendance",schoolId,classId,input.date])]);
  const existing=await db.query("SELECT id,revision FROM learning.attendance_registers WHERE peos_school_id=$1 AND peos_class_id=$2 AND attendance_date=$3 FOR UPDATE",[schoolId,classId,input.date]);
  const old=existing.rows[0];if((old?.revision??0)!==input.revision)throw new AttendanceError("REGISTER_CHANGED",409);
  const register=old??(await db.query("INSERT INTO learning.attendance_registers(peos_school_id,peos_class_id,attendance_date,updated_by) VALUES ($1,$2,$3,$4) RETURNING id,revision",[schoolId,classId,input.date,actor])).rows[0];
  const before=await db.query("SELECT learner_person_id,status FROM learning.attendance_entries WHERE register_id=$1",[register.id]);const marks=new Map(before.rows.map(r=>[r.learner_person_id,r.status]));
  const changes=input.entries.filter(r=>(marks.get(r.personId)??"UNMARKED")!==r.status).map(r=>({learnerPersonId:r.personId,from:marks.get(r.personId)??"UNMARKED",to:r.status}));
  await db.query(`INSERT INTO learning.attendance_entries(register_id,learner_person_id,status,updated_by)
    SELECT $1,x.person_id,x.status,$3 FROM jsonb_to_recordset($2::jsonb) AS x(person_id text,status text)
    ON CONFLICT(register_id,learner_person_id) DO UPDATE SET status=excluded.status,updated_by=excluded.updated_by,updated_at=now()`,[register.id,JSON.stringify(input.entries.map(r=>({person_id:r.personId,status:r.status}))),actor]);
  const revision=input.revision+1;await db.query("UPDATE learning.attendance_registers SET revision=$2,updated_by=$3,updated_at=now() WHERE id=$1",[register.id,revision,actor]);
  await audit(db,actor,schoolId,classId,"attendance.save",{date:input.date,revision,reason:input.reason,learnerCount:input.entries.length,changes});
  await db.query("COMMIT");return {saved:true,revision};
 }catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}
