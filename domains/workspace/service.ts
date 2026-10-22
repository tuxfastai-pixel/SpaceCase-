import type {Pool} from "pg";
import {z} from "zod";
export const workspaceSchema=z.object({
  timezone:z.string().min(1).max(80).refine(v=>{try{new Intl.DateTimeFormat("en",{timeZone:v});return true;}catch{return false;}},"Choose a supported timezone"),
  autoGenerateLearnerReferences:z.boolean().optional(),
  academicYearLabel:z.string().trim().min(1).max(40).regex(/^[^\u0000-\u001f\u007f]+$/),
}).strict();
export async function storageReady(pool:Pool){
  const result=await pool.query(`SELECT to_regclass('identity.persons') IS NULL AND to_regclass('organisation.organisations') IS NULL
    AND to_regclass('school_ops.school_workspaces') IS NOT NULL
    AND to_regclass('school_ops.class_workspaces') IS NOT NULL AND to_regclass('audit.product_audit_events') IS NOT NULL
    AND to_regclass('learning.learner_profiles') IS NOT NULL
    AND to_regclass('assessment.assessments') IS NOT NULL AND to_regclass('assessment.submissions') IS NOT NULL
    AND to_regclass('assessment.pages') IS NOT NULL AND to_regclass('assessment.results') IS NOT NULL
    AND to_regclass('assessment.result_events') IS NOT NULL AND to_regclass('assessment.ai_runs') IS NOT NULL
    AND to_regclass('learning.weekly_lesson_plans') IS NOT NULL
    AND to_regclass('learning.attendance_registers') IS NOT NULL AND to_regclass('learning.attendance_entries') IS NOT NULL
    AND to_regclass('support.ticket_work') IS NOT NULL AND to_regclass('support.work_events') IS NOT NULL AND to_regclass('support.work_requests') IS NOT NULL
    AND to_regclass('billing.invoices') IS NOT NULL AND to_regclass('billing.receipts') IS NOT NULL
    AND to_regclass('support.tickets') IS NOT NULL AND to_regclass('support.events') IS NOT NULL AND to_regclass('support.proposals') IS NOT NULL AS ready`);
  if(!result.rows[0]?.ready)throw new Error("STORAGE_SCHEMA_REQUIRED");
  // Prove runtime-role access rather than accepting a connection or table name alone.
  await pool.query("SELECT peos_school_id FROM school_ops.school_workspaces LIMIT 0");
  for(const table of ["assessments","submissions","pages","results","result_events","ai_runs"])await pool.query(`SELECT id FROM assessment.${table} LIMIT 0`);
  await pool.query("SELECT teacher_person_id FROM learning.weekly_lesson_plans LIMIT 0");
  await pool.query("SELECT id FROM learning.attendance_registers LIMIT 0");
  await pool.query("SELECT register_id FROM learning.attendance_entries LIMIT 0");
  await pool.query("SELECT ticket_id FROM support.ticket_work LIMIT 0");
  await pool.query("SELECT id FROM support.work_events LIMIT 0");
  await pool.query("SELECT request_id FROM support.work_requests LIMIT 0");
  await pool.query("SELECT id FROM billing.invoices LIMIT 0");
  await pool.query("SELECT id FROM billing.receipts LIMIT 0");
  await pool.query("SELECT id FROM support.tickets LIMIT 0");
  await pool.query("SELECT id FROM support.events LIMIT 0");
  await pool.query("SELECT id FROM support.proposals LIMIT 0");
  await pool.query("SELECT peos_class_id FROM school_ops.class_workspaces LIMIT 0");
  await pool.query("SELECT id FROM audit.product_audit_events LIMIT 0");
}
export async function readWorkspace(pool:Pool,schoolId:string){
  await storageReady(pool);
  const result=await pool.query(`SELECT timezone,academic_year_label AS "academicYearLabel",
    COALESCE(settings->'autoGenerateLearnerReferences'='true'::jsonb,false) AS "autoGenerateLearnerReferences" FROM school_ops.school_workspaces
    WHERE peos_school_id=$1 AND status='ACTIVE'`,[schoolId]);
  return {storageReady:true,workspace:result.rows[0]??null};
}
export async function configureWorkspace(pool:Pool,actor:string,schoolId:string,classIds:string[],input:z.infer<typeof workspaceSchema>){
  await storageReady(pool);const client=await pool.connect();
  try{
    await client.query("BEGIN");
    await client.query(`INSERT INTO school_ops.school_workspaces(peos_school_id,timezone,academic_year_label,settings) VALUES ($1,$2,$3,CASE WHEN $4::boolean IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('autoGenerateLearnerReferences',$4::boolean) END)
      ON CONFLICT(peos_school_id) DO UPDATE SET timezone=excluded.timezone,academic_year_label=excluded.academic_year_label,status='ACTIVE',settings=school_ops.school_workspaces.settings || excluded.settings,updated_at=now()`,[schoolId,input.timezone,input.academicYearLabel,input.autoGenerateLearnerReferences??null]);
    for(const classId of classIds){
      const saved=await client.query(`INSERT INTO school_ops.class_workspaces(peos_school_id,peos_class_id) VALUES ($1,$2)
        ON CONFLICT(peos_class_id) DO UPDATE SET status='ACTIVE',updated_at=now()
        WHERE school_ops.class_workspaces.peos_school_id=excluded.peos_school_id RETURNING id`,[schoolId,classId]);
      if(!saved.rowCount)throw new Error("CLASS_WORKSPACE_SCOPE_CONFLICT");
    }
    await client.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
      VALUES (gen_random_uuid(),$1,'school.workspace.configure','SCHOOL_WORKSPACE',$2,$2,'ALLOW','current_peos_school_administrator',$3::jsonb,now())`,[actor,schoolId,JSON.stringify({classCount:classIds.length,...(input.autoGenerateLearnerReferences===undefined?{}:{autoGenerateLearnerReferences:input.autoGenerateLearnerReferences})})]);
    await client.query("COMMIT");return {configured:true,classCount:classIds.length};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

// Called only after PEOS has authorized and successfully created the real class.
export async function connectCreatedClass(pool:Pool,actor:string,schoolId:string,classId:string){
  await storageReady(pool);const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const school=await client.query("SELECT id FROM school_ops.school_workspaces WHERE peos_school_id=$1 AND status='ACTIVE' FOR SHARE",[schoolId]);
    if(!school.rows.length){await client.query("ROLLBACK");return false;}
    const saved=await client.query(`INSERT INTO school_ops.class_workspaces(peos_school_id,peos_class_id) VALUES ($1,$2)
      ON CONFLICT(peos_class_id) DO UPDATE SET status='ACTIVE',updated_at=now()
      WHERE school_ops.class_workspaces.peos_school_id=excluded.peos_school_id RETURNING id`,[schoolId,classId]);
    if(!saved.rowCount)throw new Error("CLASS_WORKSPACE_SCOPE_CONFLICT");
    await client.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
      VALUES (gen_random_uuid(),$1,'school.class.workspace.connect','CLASS_WORKSPACE',$2,$3,'ALLOW','peos_class_created','{}'::jsonb,now())`,[actor,classId,schoolId]);
    await client.query("COMMIT");return true;
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
