import type {Pool} from 'pg';import {z} from 'zod';
import {boundedEngineeringText,engineeringVerificationKey} from '../../../../packages/engineering-control/transport';
import {savedTaskSchema} from '../../../../packages/engineering-control/result';
import {taskListSchema} from '../../../../packages/engineering-control/control-contract';
import {verifyTaskControl} from '../../../../packages/engineering-control/control-transport';
import {cancelBlockedTask,LedgerError,listSourceTasks} from './ledger';
export function engineeringControlHandler(deps:{env:()=>Readonly<Record<string,string|undefined>>;pool:()=>Pool;now:()=>number}){return async(request:Request)=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}}),env=deps.env();
 if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 if(env.VERCEL_ENV!=='production'||env.PSG_ENGINEERING_LEDGER_ENABLED!=='true'||!env.PSG_ENGINEERING_SIGNING_PUBLIC_KEY)return reply({error:'ENGINEERING_LEDGER_DISABLED'},503);
 let claims;
 try{const envelope=z.object({attestation:z.string().max(4096)}).strict().parse(JSON.parse(await boundedEngineeringText(request,4500)));claims=verifyTaskControl(envelope.attestation,engineeringVerificationKey(env.PSG_ENGINEERING_SIGNING_PUBLIC_KEY),deps.now());}catch{return reply({error:'INVALID_ATTESTATION'},401);}
 try{
  const authority={personId:claims.actorPersonId,founder:true,sourceRevision:0,sourceOpen:true},input=claims.input;
  if(input.purpose==='LIST_TICKET_TASKS')return reply(taskListSchema.parse(JSON.parse(JSON.stringify(await listSourceTasks(deps.pool(),authority,{sourceReference:input.sourceReference,offset:input.offset})))));
  return reply(savedTaskSchema.parse(JSON.parse(JSON.stringify(await cancelBlockedTask(deps.pool(),authority,{taskId:input.taskId,revision:input.revision},{sourceReference:input.sourceReference,idempotent:true})))));
 }catch(error){if(error instanceof LedgerError)return reply({error:error.message},error.message==='TASK_UNAVAILABLE'?404:409);return reply({error:'ENGINEERING_LEDGER_UNAVAILABLE'},503);}
};}
