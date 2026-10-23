import {timingSafeEqual} from 'node:crypto';
import type {Pool} from 'pg';
export function retentionHandler(deps:{env:()=>Readonly<Record<string,string|undefined>>;pool:()=>Pool}){return async(request:Request)=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 const env=deps.env(),secret=env.CRON_SECRET;
 if(env.VERCEL_ENV!=='production'||env.PSG_ENGINEERING_LEDGER_ENABLED!=='true'||!secret||secret.length<32)return reply({error:'RETENTION_DISABLED'},503);
 const provided=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from(`Bearer ${secret}`);
 if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return reply({error:'UNAUTHENTICATED'},401);
 try{
  let removed=0;for(let batch=0;batch<4;batch++){const r=await deps.pool().query('SELECT engineering.expire_briefs(500) AS removed');removed+=r.rows[0].removed;if(r.rows[0].removed<500)break;}
  let evidenceRemoved=0;for(let batch=0;batch<4;batch++){const r=await deps.pool().query('SELECT engineering.expire_evidence(500) AS removed');evidenceRemoved+=r.rows[0].removed;if(r.rows[0].removed<500)break;}
  return reply({removed,evidenceRemoved,executionStarted:false});
 }catch{return reply({error:'RETENTION_UNAVAILABLE'},503);}
};}
