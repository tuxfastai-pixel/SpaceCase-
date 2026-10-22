import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {Pool} from 'pg';

export async function migrateEngineering(pool:Pool){
 const db=await pool.connect();
 try{
  // Fail before creating metadata if pointed at SpaceCase or PEOS by mistake.
  const tables=await db.query("SELECT to_regclass('support.tickets') IS NOT NULL OR to_regnamespace('school_ops') IS NOT NULL OR to_regnamespace('identity') IS NOT NULL AS product");
  if(tables.rows[0].product)throw new Error('DEDICATED_ENGINEERING_DATABASE_REQUIRED');
  const role=await db.query("SELECT r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS inherited,EXISTS(SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND d.datdba=r.oid) AS owner FROM pg_roles r WHERE r.rolname='psg_engineering_runtime'");
  if(!role.rowCount||Object.values(role.rows[0]).some(Boolean))throw new Error('RESTRICTED_ENGINEERING_ROLE_REQUIRED');
  await db.query('BEGIN');
  await db.query("SET LOCAL statement_timeout='10000ms'");
  await db.query('SELECT pg_advisory_xact_lock(724355001)');
  await db.query('CREATE SCHEMA IF NOT EXISTS psg_engineering_meta');
  await db.query('REVOKE ALL ON SCHEMA psg_engineering_meta FROM PUBLIC');
  await db.query('CREATE TABLE IF NOT EXISTS psg_engineering_meta.migrations(name text PRIMARY KEY, checksum text NOT NULL)');
  const directory=new URL('./migrations/',import.meta.url);
  for(const name of (await readdir(directory)).filter(n=>/^\d{4}_[a-z_]+\.sql$/.test(n)).sort()){
   const sql=await readFile(new URL(name,directory),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
   const old=await db.query('SELECT checksum FROM psg_engineering_meta.migrations WHERE name=$1',[name]);
   if(old.rowCount){if(old.rows[0].checksum!==checksum)throw new Error('ENGINEERING_MIGRATION_CHECKSUM_MISMATCH');continue;}
   await db.query(sql);await db.query('INSERT INTO psg_engineering_meta.migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
  }
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
