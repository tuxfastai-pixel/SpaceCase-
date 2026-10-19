import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";
import {Pool} from "pg";
import {configureWorkspace,readWorkspace,storageReady} from "../../domains/workspace/service";
test("workspace setup persists settings, binds classes and rolls back conflicting school bindings",{skip:!process.env.CI||!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const actor=randomUUID(),school=randomUUID(),other=randomUUID(),classId=randomUUID();
 try{
  await storageReady(pool);assert.equal((await readWorkspace(pool,school)).workspace,null);
  await configureWorkspace(pool,actor,school,[classId],{timezone:"Africa/Johannesburg",academicYearLabel:"2026"});
  assert.deepEqual((await readWorkspace(pool,school)).workspace,{timezone:"Africa/Johannesburg",academicYearLabel:"2026"});
  await assert.rejects(configureWorkspace(pool,actor,other,[classId],{timezone:"UTC",academicYearLabel:"2027"}),/CLASS_WORKSPACE_SCOPE_CONFLICT/);
  assert.equal((await readWorkspace(pool,other)).workspace,null);
  await configureWorkspace(pool,actor,school,[classId],{timezone:"UTC",academicYearLabel:"2027"});
  assert.equal((await readWorkspace(pool,school)).workspace.academicYearLabel,"2027");
  const audits=await pool.query("SELECT metadata FROM audit.product_audit_events WHERE actor_person_id=$1",[actor]);assert.equal(audits.rowCount,2);
 }finally{
  await pool.query("DELETE FROM school_ops.class_workspaces WHERE peos_school_id=ANY($1::text[])",[[school,other]]);
  await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=ANY($1::text[])",[[school,other]]);
  await pool.query("DELETE FROM audit.product_audit_events WHERE actor_person_id=$1",[actor]);await pool.end();
 }
});
