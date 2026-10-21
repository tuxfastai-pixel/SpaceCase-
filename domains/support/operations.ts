import type {Pool} from "pg";
import {assertFounder,type SupportContext} from "./contracts";
export async function directoryHealth(pool:Pool,c:SupportContext,schoolIds:string[]){
 assertFounder(c);if(!schoolIds.length)return [];
 const r=await pool.query(`SELECT ids.id AS "schoolId",COALESCE(s.status='ACTIVE',false) AS configured,s.timezone,
 (SELECT count(*)::int FROM support.tickets t WHERE t.school_id=ids.id AND t.status NOT IN ('RESOLVED','CLOSED')) AS "openTickets"
 FROM unnest($1::text[]) AS ids(id) LEFT JOIN school_ops.school_workspaces s ON s.peos_school_id=ids.id`,[schoolIds]);return r.rows;
}
export async function schoolOperations(pool:Pool,c:SupportContext,schoolId:string,classIds:string[]){
 assertFounder(c);
 const [workspace,classes,tickets,audit]=await Promise.all([
 pool.query(`SELECT status,timezone,academic_year_label AS "academicYearLabel",COALESCE(settings->'autoGenerateLearnerReferences'='true'::jsonb,false) AS "autoGenerateLearnerReferences" FROM school_ops.school_workspaces WHERE peos_school_id=$1`,[schoolId]),
 pool.query("SELECT peos_class_id AS id FROM school_ops.class_workspaces WHERE peos_school_id=$1 AND status='ACTIVE' AND peos_class_id=ANY($2::text[])",[schoolId,classIds]),
 pool.query("SELECT status,count(*)::int AS count FROM support.tickets WHERE school_id=$1 GROUP BY status",[schoolId]),
 pool.query(`SELECT id,action,resource_type AS "resourceType",occurred_at AS "occurredAt" FROM audit.product_audit_events WHERE school_id=$1 AND (action LIKE 'school.%' OR action LIKE 'support.%') ORDER BY occurred_at DESC,id DESC LIMIT 50`,[schoolId])
 ]);
 return {workspace:workspace.rows[0]??null,connectedClassIds:classes.rows.map(r=>r.id),ticketCounts:tickets.rows,audit:audit.rows};
}
