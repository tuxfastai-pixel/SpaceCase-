import type {Pool} from "pg";
import {assertFounder,type SupportContext} from "./contracts";
export const patternMinimumSchools=5;
export async function founderInsights(pool:Pool,c:SupportContext){
 assertFounder(c);const db=await pool.connect();
 try{
 await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
 await db.query("SET LOCAL statement_timeout='8000ms'");
 const workspaces=await db.query(`SELECT count(*)::int AS "recordedWorkspaces",count(*) FILTER(WHERE status='ACTIVE')::int AS "activeWorkspaces",count(*) FILTER(WHERE status='ACTIVE' AND (timezone IS NULL OR academic_year_label IS NULL))::int AS "incompleteWorkspaces" FROM school_ops.school_workspaces`);
 const activity=await db.query(`SELECT count(DISTINCT peos_school_id)::int AS "schoolsUpdatingRegisters",count(*)::int AS "registersUpdated" FROM learning.attendance_registers WHERE updated_at>=now()-interval '30 days'`);
 const periods=await db.query(`SELECT count(*) FILTER(WHERE created_at>=now()-interval '30 days')::int AS current,count(*) FILTER(WHERE created_at<now()-interval '30 days')::int AS previous FROM support.tickets WHERE created_at>=now()-interval '60 days'`);
 const queue=await db.query(`SELECT count(*)::int AS open,count(*) FILTER(WHERE impact='BLOCKED')::int AS blocked,count(*) FILTER(WHERE priority='URGENT')::int AS urgent,count(*) FILTER(WHERE created_at<now()-interval '48 hours')::int AS "olderThan48Hours" FROM support.tickets WHERE status NOT IN ('RESOLVED','CLOSED')`);
 const response=await db.query(`SELECT count(*)::int AS submitted,count(first_response)::int AS responded,
 round((percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM first_response-created_at)/3600) FILTER(WHERE first_response IS NOT NULL))::numeric,1)::float AS "medianFirstResponseHours"
 FROM (SELECT t.created_at,(SELECT min(e.created_at) FROM support.events e WHERE e.ticket_id=t.id AND e.kind='TECHNICAL_UPDATE') AS first_response FROM support.tickets t WHERE t.created_at>=now()-interval '30 days') s`);
 const patterns=await db.query(`SELECT area,category,count(*)::int AS tickets,count(DISTINCT school_id)::int AS schools FROM support.tickets WHERE created_at>=now()-interval '30 days' GROUP BY area,category HAVING count(DISTINCT school_id)>=$1 ORDER BY count(*) DESC,area,category LIMIT 10`,[patternMinimumSchools]);
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at) VALUES(gen_random_uuid(),$1,'support.insights.read','FOUNDER_INSIGHTS',$1,'','ALLOW','current_global_founder','{}'::jsonb,clock_timestamp())`,[c.personId]);
 await db.query("COMMIT");
 return {asOf:new Date().toISOString(),windowDays:30,workspaces:workspaces.rows[0],activity:activity.rows[0],submissions:periods.rows[0],queue:queue.rows[0],response:response.rows[0],patterns:patterns.rows,patternMinimumSchools,unmeasured:["Invitation conversion and onboarding abandonment","Weekly active people and repeat tool use","Expected attendance completion","Service uptime, error rates and cost per school"],automatedRecommendations:false};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
