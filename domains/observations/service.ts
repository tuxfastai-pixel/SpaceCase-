import type {Pool,PoolClient} from "pg";
import {schoolDate,type AttendanceRoster} from "../attendance/contracts";
import {ObservationError,type ObservationInput,type ObservationQuery,type ObservationRecord} from "./contracts";
const columns=`id,learner_person_id AS "learnerId",kind,observed_date::text AS "observedDate",context,evidence,response,next_step AS "nextStep",follow_up_date::text AS "followUpDate",state,outcome,revision,updated_at AS "updatedAt"`;
async function workspace(db:PoolClient,school:string,classId:string,roster:AttendanceRoster){
 if(roster.class.id!==classId||new Set(roster.learners.map(l=>l.personId)).size!==roster.learners.length)throw new ObservationError("ROSTER_CHANGED",409);
 const r=await db.query(`SELECT s.timezone FROM school_ops.school_workspaces s JOIN school_ops.class_workspaces c ON c.peos_school_id=s.peos_school_id
 WHERE s.peos_school_id=$1 AND c.peos_class_id=$2 AND s.status='ACTIVE' AND c.status='ACTIVE' FOR SHARE OF s,c`,[school,classId]);
 if(!r.rows[0])throw new ObservationError("CLASS_WORKSPACE_REQUIRED",409);return r.rows[0].timezone as string;
}
async function audit(db:PoolClient,actor:string,school:string,resource:string,action:string,metadata:unknown){
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
 VALUES(gen_random_uuid(),$1,$2,'CLASSROOM_OBSERVATION',$3,$4,'ALLOW','current_peos_class_teacher',$5::jsonb,now())`,[actor,`observations.${action.toLowerCase()}`,resource,school,JSON.stringify(metadata)]);
}
export async function readObservations(pool:Pool,actor:string,school:string,classId:string,roster:AttendanceRoster,query:ObservationQuery){
 const db=await pool.connect();try{
  await db.query("BEGIN");const timezone=await workspace(db,school,classId,roster);const ids=roster.learners.map(l=>l.personId);
  const common={timezone,today:schoolDate(timezone),roster};
  if(query.record){
   const r=await db.query(`SELECT ${columns} FROM learning.classroom_observations WHERE id=$1 AND teacher_person_id=$2 AND peos_school_id=$3 AND peos_class_id=$4 AND learner_person_id=ANY($5::text[])`,[query.record,actor,school,classId,ids]);
   if(!r.rows[0])throw new ObservationError("RECORD_NOT_FOUND",404);
   const history=await db.query(`SELECT revision,action,reason,occurred_at AS "occurredAt" FROM learning.observation_revisions WHERE observation_id=$1 ORDER BY revision DESC LIMIT 50`,[query.record]);
   await audit(db,actor,school,query.record,"READ",{revision:r.rows[0].revision});await db.query("COMMIT");
   return {...common,record:r.rows[0] as ObservationRecord,history:history.rows};
  }
  if(query.learner&&!ids.includes(query.learner))throw new ObservationError("LEARNER_NOT_IN_CLASS",409);
  const rows=await db.query(`SELECT id,learner_person_id AS "learnerId",kind,observed_date::text AS "observedDate",follow_up_date::text AS "followUpDate",state,revision
   FROM learning.classroom_observations WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 AND learner_person_id=ANY($4::text[])
   AND ($5::text IS NULL OR learner_person_id=$5) AND ($6::text IS NULL OR state=$6) ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $7`,[actor,school,classId,ids,query.learner??null,query.state??null,query.offset]);
  await audit(db,actor,school,classId,"LIST",{offset:query.offset});await db.query("COMMIT");
  return {...common,records:rows.rows.slice(0,50),nextOffset:rows.rows.length>50?query.offset+50:null};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
export async function saveObservation(pool:Pool,actor:string,school:string,classId:string,roster:AttendanceRoster,input:ObservationInput){
 const db=await pool.connect();try{
  await db.query("BEGIN");const timezone=await workspace(db,school,classId,roster);const today=schoolDate(timezone),ids=roster.learners.map(l=>l.personId);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`observation:${input.recordId}`]);
  const old=await db.query(`SELECT ${columns} FROM learning.classroom_observations WHERE id=$1 AND teacher_person_id=$2 AND peos_school_id=$3 AND peos_class_id=$4 AND learner_person_id=ANY($5::text[]) FOR UPDATE`,[input.recordId,actor,school,classId,ids]);
  const record=old.rows[0] as ObservationRecord|undefined;let revision=1;
  if("fields" in input&&input.fields.observedDate>today)throw new ObservationError("FUTURE_OBSERVATION_DATE",400);
  if(input.action==="CREATE"){
   if(!ids.includes(input.learnerId))throw new ObservationError("LEARNER_NOT_IN_CLASS",409);
   if(record)throw new ObservationError("RECORD_CHANGED",409);const f=input.fields;
   const result=await db.query(`INSERT INTO learning.classroom_observations(id,teacher_person_id,peos_school_id,peos_class_id,learner_person_id,kind,observed_date,context,evidence,response,next_step,follow_up_date)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING`,[input.recordId,actor,school,classId,input.learnerId,f.kind,f.observedDate,f.context,f.evidence,f.response,f.nextStep,f.followUpDate]);
   if(result.rowCount!==1)throw new ObservationError("RECORD_CHANGED",409);
  }else{
   if(!record)throw new ObservationError("RECORD_NOT_FOUND",404);
   if(record.revision!==input.revision)throw new ObservationError("RECORD_CHANGED",409);
   if(record.state==="RETRACTED")throw new ObservationError("RECORD_RETRACTED",409);revision=record.revision+1;
   if(input.action==="EDIT"){
    if(record.state!=="OPEN")throw new ObservationError("OPEN_RECORD_REQUIRED",409);const f=input.fields;
    await db.query(`UPDATE learning.classroom_observations SET kind=$2,observed_date=$3,context=$4,evidence=$5,response=$6,next_step=$7,follow_up_date=$8 WHERE id=$1`,[input.recordId,f.kind,f.observedDate,f.context,f.evidence,f.response,f.nextStep,f.followUpDate]);
   }else if(input.action==="RESOLVE"){
    if(record.state!=="OPEN")throw new ObservationError("OPEN_RECORD_REQUIRED",409);
    await db.query("UPDATE learning.classroom_observations SET state='RESOLVED',outcome=$2 WHERE id=$1",[input.recordId,input.outcome]);
   }else if(input.action==="REOPEN"){
    if(record.state!=="RESOLVED")throw new ObservationError("RESOLVED_RECORD_REQUIRED",409);
    await db.query("UPDATE learning.classroom_observations SET state='OPEN',outcome='' WHERE id=$1",[input.recordId]);
   }else await db.query("UPDATE learning.classroom_observations SET state='RETRACTED' WHERE id=$1",[input.recordId]);
   await db.query("UPDATE learning.classroom_observations SET revision=$2,updated_at=now() WHERE id=$1",[input.recordId,revision]);
  }
  const saved=await db.query(`SELECT ${columns} FROM learning.classroom_observations WHERE id=$1`,[input.recordId]);
  await db.query("INSERT INTO learning.observation_revisions(observation_id,actor_person_id,revision,action,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[input.recordId,actor,revision,input.action,"reason" in input?input.reason:null,JSON.stringify(saved.rows[0])]);
  await audit(db,actor,school,input.recordId,input.action,{revision});await db.query("COMMIT");return {saved:true,recordId:input.recordId,revision};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
