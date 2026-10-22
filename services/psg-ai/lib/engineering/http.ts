import {z} from 'zod';
import type {Pool} from 'pg';
import {AttestationError,boundedEngineeringText,engineeringVerificationKey,savedTaskSchema,verifyTaskSave} from '../../../../packages/engineering-control/transport';
import {LedgerError,saveBlockedTask} from './ledger';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
type Deps={env:()=>Readonly<Record<string,string|undefined>>;pool:()=>Pool;now:()=>number};
export function engineeringTasksHandler(deps:Deps){return async(request:Request)=>{
 if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 const env=deps.env();
 if(env.VERCEL_ENV!=='production'||env.PSG_ENGINEERING_LEDGER_ENABLED!=='true'||!env.PSG_ENGINEERING_SIGNING_PUBLIC_KEY)return reply({error:'ENGINEERING_LEDGER_DISABLED'},503);
 let key;try{key=engineeringVerificationKey(env.PSG_ENGINEERING_SIGNING_PUBLIC_KEY);}catch{return reply({error:'ENGINEERING_LEDGER_DISABLED'},503);}
 let claims;
 try{
  const envelope=z.object({attestation:z.string().max(87500)}).strict().parse(JSON.parse(await boundedEngineeringText(request,90000)));
  claims=verifyTaskSave(envelope.attestation,key,deps.now());
 }catch(error){return reply({error:error instanceof AttestationError&&error.message==='INPUT_TOO_LARGE'?'INPUT_TOO_LARGE':'INVALID_ATTESTATION'},error instanceof AttestationError&&error.message==='INPUT_TOO_LARGE'?413:401);}
 try{
  const result=await saveBlockedTask(deps.pool(),{personId:claims.actorPersonId,founder:true,sourceRevision:claims.request.handoff.source.revision,sourceOpen:true},{requestId:claims.requestId,request:claims.request});
  return reply(savedTaskSchema.parse(JSON.parse(JSON.stringify(result))));
 }catch(error){if(error instanceof LedgerError&&error.message==='REQUEST_REUSED')return reply({error:'REQUEST_REUSED'},409);return reply({error:'ENGINEERING_LEDGER_UNAVAILABLE'},503);}
};}
