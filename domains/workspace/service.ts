import type {Pool} from "pg";
import {z} from "zod";
export const workspaceSchema=z.object({
  timezone:z.string().min(1).max(80).refine(v=>{try{new Intl.DateTimeFormat("en",{timeZone:v});return true;}catch{return false;}},"Choose a supported timezone"),
  academicYearLabel:z.string().trim().min(1).max(40).regex(/^[^\u0000-\u001f\u007f]+$/),
}).strict();
export async function storageReady(pool:Pool){
  const result=await pool.query(`SELECT to_regclass('identity.persons') IS NULL AND to_regclass('organisation.organisations') IS NULL
    AND to_regclass('school_ops.school_workspaces') IS NOT NULL
    AND to_regclass('school_ops.class_workspaces') IS NOT NULL AND to_regclass('audit.product_audit_events') IS NOT NULL
    AND to_regclass('learning.learner_profiles') IS NOT NULL AS ready`);
  if(!result.rows[0]?.ready)throw new Error("STORAGE_SCHEMA_REQUIRED");
  // Prove runtime-role access rather than accepting a connection or table name alone.
  await pool.query("SELECT peos_school_id FROM school_ops.school_workspaces LIMIT 0");
  await pool.query("SELECT peos_class_id FROM school_ops.class_workspaces LIMIT 0");
  await pool.query("SELECT id FROM audit.product_audit_events LIMIT 0");
}
export async function readWorkspace(pool:Pool,schoolId:string){
  await storageReady(pool);
  const result=await pool.query(`SELECT timezone,academic_year_label AS "academicYearLabel" FROM school_ops.school_workspaces
    WHERE peos_school_id=$1 AND status='ACTIVE'`,[schoolId]);
  return {storageReady:true,workspace:result.rows[0]??null};
}
export async function configureWorkspace(pool:Pool,actor:string,schoolId:string,classIds:string[],input:z.infer<typeof workspaceSchema>){
  await storageReady(pool);const client=await pool.connect();
  try{
    await client.query("BEGIN");
    await client.query(`INSERT INTO school_ops.school_workspaces(peos_school_id,timezone,academic_year_label) VALUES ($1,$2,$3)
      ON CONFLICT(peos_school_id) DO UPDATE SET timezone=excluded.timezone,academic_year_label=excluded.academic_year_label,status='ACTIVE',updated_at=now()`,[schoolId,input.timezone,input.academicYearLabel]);
    for(const classId of classIds){
      const saved=await client.query(`INSERT INTO school_ops.class_workspaces(peos_school_id,peos_class_id) VALUES ($1,$2)
        ON CONFLICT(peos_class_id) DO UPDATE SET status='ACTIVE',updated_at=now()
        WHERE school_ops.class_workspaces.peos_school_id=excluded.peos_school_id RETURNING id`,[schoolId,classId]);
      if(!saved.rowCount)throw new Error("CLASS_WORKSPACE_SCOPE_CONFLICT");
    }
    await client.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
      VALUES (gen_random_uuid(),$1,'school.workspace.configure','SCHOOL_WORKSPACE',$2,$2,'ALLOW','current_peos_school_administrator',$3::jsonb,now())`,[actor,schoolId,JSON.stringify({classCount:classIds.length})]);
    await client.query("COMMIT");return {configured:true,classCount:classIds.length};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
