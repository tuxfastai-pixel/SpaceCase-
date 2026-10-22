import {Pool} from 'pg';
let pool:Pool|undefined;
export function getEngineeringPool(){
 const connectionString=process.env.PSG_ENGINEERING_DATABASE_URL;
 if(!connectionString)throw new Error('ENGINEERING_DATABASE_NOT_CONFIGURED');
 pool??=new Pool({connectionString,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
 return pool;
}
