import {Pool} from 'pg';
import {migrateEngineering} from './migrate-ledger';
async function run(){
 const url=process.env.PSG_ENGINEERING_DATABASE_URL_UNPOOLED;
 if(!url||new URL(url).hostname.includes('-pooler'))throw new Error('DIRECT_ENGINEERING_DATABASE_URL_REQUIRED');
 const pool=new Pool({connectionString:url,max:1});
 try{await migrateEngineering(pool);}finally{await pool.end();}
}
run().catch(()=>{console.error('Engineering migration failed; verify the dedicated database, restricted role and migration checksums.');process.exitCode=1;});
