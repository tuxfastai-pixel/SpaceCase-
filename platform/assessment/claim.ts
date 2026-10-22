import {createHash,timingSafeEqual} from "node:crypto";
import type {Pool} from "pg";
import {claimSchema} from "../../contracts/assessmentVision";
import {boundedText} from "../http/boundedText";
import {getDatabasePool} from "../db/pool";
export function serviceAuthenticated(request:Request){
 const token=process.env.PSG_AI_SERVICE_TOKEN;if(!token||token.length<32)return false;
 const expected=createHash("sha256").update(`Bearer ${token}`).digest();const actual=createHash("sha256").update(request.headers.get("authorization")??"").digest();return timingSafeEqual(expected,actual);
}
export function claimHandler(pool:()=>Pool=getDatabasePool){return async(request:Request)=>{
 const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store"}});
 if(!serviceAuthenticated(request))return reply({error:"UNAUTHENTICATED"},401);
 const limit=Number(process.env.SPACECASE_ASSESSMENT_AI_DAILY_LIMIT??0);
 if(process.env.SPACECASE_ASSESSMENT_AI_ENABLED!=="true"||!Number.isInteger(limit)||limit<1||limit>100)return reply({error:"AI_DISABLED"},503);
 let input;try{const raw=await boundedText(request,3000);input=claimSchema.parse(JSON.parse(raw));}catch{return reply({error:"INVALID_INPUT"},400);}
 const db=await pool().connect();try{
  await db.query("BEGIN");await db.query("SELECT pg_advisory_xact_lock(hashtextextended('assessment-global-claims',0))");
  const r=await db.query(`SELECT j.id FROM assessment.ai_runs j JOIN assessment.submissions s ON s.id=j.submission_id JOIN assessment.assessments a ON a.id=s.assessment_id
    JOIN school_ops.class_workspaces c ON c.peos_class_id=a.peos_class_id AND c.peos_school_id=a.peos_school_id
    JOIN school_ops.school_workspaces w ON w.peos_school_id=a.peos_school_id
    WHERE j.id=$1 AND j.actor_person_id=$2 AND a.teacher_person_id=$2 AND a.peos_school_id=$3 AND a.id=$4 AND s.id=$5
    AND j.source_revision=$6 AND s.revision=$6 AND j.input_hash=$7 AND j.purpose=$8 AND j.status='RUNNING' AND j.execution_claimed_at IS NULL
    AND ($8='READ' OR s.reading_review IS NOT NULL) AND j.created_at>now()-interval '2 minutes' AND s.matching_confirmed AND s.current_result_id IS NULL AND w.status='ACTIVE' AND c.status='ACTIVE' FOR UPDATE OF j,s`,[input.requestId,input.actorPersonId,input.schoolId,input.assessmentId,input.submissionRef,input.sourceRevision,input.inputHash,input.mode]);
  if(!r.rowCount){await db.query("ROLLBACK");return reply({error:"CLAIM_UNAVAILABLE"},409);}
  const usage=await db.query("SELECT count(*)::int AS n FROM assessment.ai_runs WHERE execution_claimed_at>now()-interval '24 hours'");
  if(usage.rows[0].n>=limit){await db.query("ROLLBACK");return reply({error:"AI_RATE_LIMIT"},429);}
  await db.query("UPDATE assessment.ai_runs SET execution_claimed_at=now() WHERE id=$1",[input.requestId]);await db.query("COMMIT");return reply({allowed:true});
 }catch{await db.query("ROLLBACK");return reply({error:"CLAIM_UNAVAILABLE"},503);}finally{db.release();}
};}
