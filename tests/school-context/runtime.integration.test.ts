import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {PostgresSchoolContextRepository} from '../../domains/school-context/postgresRepository';

test('restricted runtime reads school and assigned class configuration without write privileges',{skip:!process.env.DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),school=randomUUID(),classId=randomUUID();
 const db=await pool.connect();
 try{
  await db.query("INSERT INTO school_ops.school_workspaces(peos_school_id,timezone,academic_year_label) VALUES($1,'Africa/Johannesburg','2027')",[school]);
  await db.query('INSERT INTO school_ops.class_workspaces(peos_school_id,peos_class_id) VALUES($1,$2)',[school,classId]);
  await db.query('SET ROLE spacecase_runtime');
  const runtime={query:(sql:string,values?:unknown[])=>db.query(sql,values)} as unknown as Pool;
  const repository=new PostgresSchoolContextRepository(runtime);
  assert.equal((await repository.getSchoolWorkspace(school))?.academicYearLabel,'2027');
  assert.deepEqual((await repository.getClassWorkspaces(school,[classId])).map(c=>c.peosClassId),[classId]);
  assert.deepEqual(await repository.getClassWorkspaces(randomUUID(),[classId]),[]);
  assert.equal(await repository.getSchoolWorkspace(randomUUID()),null);
  for(const table of ['school_ops.school_workspaces','school_ops.class_workspaces']){
   const privileges=(await db.query("SELECT has_table_privilege(current_user,$1,'INSERT') AS insert,has_table_privilege(current_user,$1,'UPDATE') AS update,has_table_privilege(current_user,$1,'DELETE') AS delete",[table])).rows[0];
   assert.deepEqual(privileges,{insert:false,update:false,delete:false});
  }
 }finally{
  await db.query('RESET ROLE');
  await db.query('DELETE FROM school_ops.class_workspaces WHERE peos_school_id=$1',[school]);
  await db.query('DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1',[school]);
  db.release();await pool.end();
 }
});
