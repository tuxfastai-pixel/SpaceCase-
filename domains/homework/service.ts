import type {Pool,PoolClient} from "pg";
import {schoolDate,type AttendanceRoster} from "../attendance/contracts";
import {HomeworkError,type HomeworkInput,type Task} from "./contracts";
async function workspace(db:PoolClient,school:string,classId:string){
 const r=await db.query(`SELECT s.timezone FROM school_ops.school_workspaces s JOIN school_ops.class_workspaces c ON c.peos_school_id=s.peos_school_id
 WHERE s.peos_school_id=$1 AND c.peos_class_id=$2 AND s.status='ACTIVE' AND c.status='ACTIVE' FOR SHARE OF s,c`,[school,classId]);
 if(!r.rows[0])throw new HomeworkError("CLASS_WORKSPACE_REQUIRED",409);return r.rows[0].timezone as string;
}
const columns=`id,title,subject,instructions,assigned_date::text AS "assignedDate",due_date::text AS "dueDate",state,revision,completions,updated_at AS "updatedAt"`;
async function audit(db:PoolClient,actor:string,school:string,taskId:string,action:string,metadata:unknown){
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
 VALUES(gen_random_uuid(),$1,$2,'HOMEWORK',$3,$4,'ALLOW','current_peos_class_teacher',$5::jsonb,now())`,[actor,`homework.${action.toLowerCase()}`,taskId,school,JSON.stringify(metadata)]);
}
export async function readHomework(pool:Pool,actor:string,school:string,classId:string,taskId?:string,offset=0,roster?:AttendanceRoster){
 const db=await pool.connect();try{
  await db.query("BEGIN");const timezone=await workspace(db,school,classId);
  if(taskId){
   const r=await db.query(`SELECT ${columns} FROM learning.homework_tasks WHERE id=$1 AND teacher_person_id=$2 AND peos_school_id=$3 AND peos_class_id=$4`,[taskId,actor,school,classId]);
   if(!r.rows[0])throw new HomeworkError("TASK_NOT_FOUND",404);
   if(!roster||roster.class.id!==classId)throw new HomeworkError("ROSTER_CHANGED",409);
   const task=r.rows[0] as Task;const visible=new Set(roster.learners.map(l=>l.personId));
   task.completions=Object.fromEntries(Object.entries(task.completions).filter(([id])=>visible.has(id)));
   const history=await db.query(`SELECT revision,action,occurred_at AS "occurredAt",metadata->>'reason' AS reason,
    CASE WHEN metadata ? 'changes' THEN jsonb_array_length(metadata->'changes') ELSE 0 END AS "changeCount"
    FROM learning.homework_events WHERE task_id=$1 ORDER BY revision DESC LIMIT 50`,[taskId]);
   await audit(db,actor,school,taskId,"READ",{revision:task.revision});await db.query("COMMIT");
   return {task,roster,history:history.rows,timezone,today:schoolDate(timezone)};
  }
  const r=await db.query(`SELECT id,title,subject,assigned_date::text AS "assignedDate",due_date::text AS "dueDate",state,revision FROM learning.homework_tasks
   WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $4`,[actor,school,classId,offset]);
  await audit(db,actor,school,classId,"LIST",{offset});await db.query("COMMIT");
  return {tasks:r.rows.slice(0,50),nextOffset:r.rows.length>50?offset+50:null,timezone,today:schoolDate(timezone)};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
export async function saveHomework(pool:Pool,actor:string,school:string,classId:string,input:HomeworkInput,roster?:AttendanceRoster){
 const db=await pool.connect();try{
  await db.query("BEGIN");await workspace(db,school,classId);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`homework:${input.taskId}`]);
  const found=await db.query(`SELECT ${columns} FROM learning.homework_tasks WHERE id=$1 AND teacher_person_id=$2 AND peos_school_id=$3 AND peos_class_id=$4 FOR UPDATE`,[input.taskId,actor,school,classId]);
  const old=found.rows[0] as Task|undefined;let revision=1;let metadata:unknown={};
  if(input.action==="CREATE"){
   if(old)throw new HomeworkError("TASK_CHANGED",409);
   const f=input.fields;
   const result=await db.query(`INSERT INTO learning.homework_tasks(id,teacher_person_id,peos_school_id,peos_class_id,title,subject,instructions,assigned_date,due_date)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,[input.taskId,actor,school,classId,f.title,f.subject,f.instructions,f.assignedDate,f.dueDate]);
   if(result.rowCount!==1)throw new HomeworkError("TASK_CHANGED",409);
  }else{
   if(!old)throw new HomeworkError("TASK_NOT_FOUND",404);
   if(old.revision!==input.revision)throw new HomeworkError("TASK_CHANGED",409);revision=old.revision+1;
   if(input.action==="EDIT"){
    if(old.state!=="DRAFT")throw new HomeworkError("DRAFT_REQUIRED",409);
    const f=input.fields;await db.query(`UPDATE learning.homework_tasks SET title=$2,subject=$3,instructions=$4,assigned_date=$5,due_date=$6 WHERE id=$1`,[input.taskId,f.title,f.subject,f.instructions,f.assignedDate,f.dueDate]);
    metadata={changedFields:Object.keys(f).filter(k=>f[k as keyof typeof f]!==old[k as keyof typeof f])};
   }else if(input.action==="COMPLETIONS"){
    if(old.state!=="ASSIGNED")throw new HomeworkError("ASSIGNED_REQUIRED",409);
    const current=new Set(roster?.learners.map(l=>l.personId));
    if(!roster||roster.class.id!==classId||current.size!==roster.learners.length||new Set(input.entries.map(e=>e.personId)).size!==input.entries.length||input.entries.length!==current.size||input.entries.some(e=>!current.has(e.personId)))throw new HomeworkError("ROSTER_CHANGED",409);
    const changes=input.entries.filter(e=>(old.completions[e.personId]??"PENDING")!==e.status).map(e=>({...e,previous:old.completions[e.personId]??"PENDING"}));
    if(changes.some(e=>e.previous!=="PENDING")&&input.reason==="INITIAL_RECORD")throw new HomeworkError("CORRECTION_REASON_REQUIRED",409);
    const completions={...old.completions,...Object.fromEntries(input.entries.map(e=>[e.personId,e.status]))};
    await db.query("UPDATE learning.homework_tasks SET completions=$2::jsonb WHERE id=$1",[input.taskId,JSON.stringify(completions)]);metadata={reason:input.reason,changes};
   }else{
    const expected=input.action==="ASSIGN"?"DRAFT":input.action==="CLOSE"?"ASSIGNED":"CLOSED";
    const next=input.action==="CLOSE"?"CLOSED":"ASSIGNED";
    if(old.state!==expected)throw new HomeworkError("INVALID_TRANSITION",409);
    await db.query("UPDATE learning.homework_tasks SET state=$2 WHERE id=$1",[input.taskId,next]);metadata={previous:old.state,state:next};
   }
   await db.query("UPDATE learning.homework_tasks SET revision=$2,updated_at=now() WHERE id=$1",[input.taskId,revision]);
  }
  await db.query("INSERT INTO learning.homework_events(task_id,actor_person_id,revision,action,metadata) VALUES($1,$2,$3,$4,$5::jsonb)",[input.taskId,actor,revision,input.action,JSON.stringify(metadata)]);
  await audit(db,actor,school,input.taskId,input.action,{revision});await db.query("COMMIT");return {saved:true,taskId:input.taskId,revision};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
