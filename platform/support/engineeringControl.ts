import {z} from 'zod';import type {Pool} from 'pg';
import {assertFounder,SupportError,type SupportContext} from '../../domains/support/contracts';
import {boundedEngineeringText,engineeringSigningKey} from '../../packages/engineering-control/transport';
import {signTaskControl} from '../../packages/engineering-control/control-transport';
import {taskListSchema,type EngineeringControlInput} from '../../packages/engineering-control/control-contract';
import {savedTaskSchema} from '../../packages/engineering-control/result';
export const taskControlInput=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('LIST'),ticketId:z.string().uuid(),offset:z.number().int().min(0).max(10000).default(0)}).strict(),
 z.object({operation:z.literal('CANCEL'),ticketId:z.string().uuid(),taskId:z.string().uuid(),revision:z.number().int().nonnegative()}).strict(),
]);
export async function controlEngineeringTask(pool:Pool,c:SupportContext,input:z.infer<typeof taskControlInput>,deps={env:()=>process.env as Readonly<Record<string,string|undefined>>,fetch,now:()=>Math.floor(Date.now()/1000)}){
 assertFounder(c);const parsed=taskControlInput.parse(input),env=deps.env();
 if(env.VERCEL_ENV!=='production'||env.SPACECASE_ENGINEERING_LEDGER_ENABLED!=='true'||!env.PSG_ENGINEERING_BASE_URL||!env.SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY)throw new SupportError('ENGINEERING_LEDGER_DISABLED',503);
 let origin:URL,key;
 try{origin=new URL(env.PSG_ENGINEERING_BASE_URL);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash)throw Error();key=engineeringSigningKey(env.SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY);}catch{throw new SupportError('ENGINEERING_LEDGER_DISABLED',503);}
 // Only the opaque reference is needed. Closed tickets may still cancel blocked work.
 const source=await pool.query('SELECT reference FROM support.tickets WHERE id=$1',[parsed.ticketId]);if(!source.rowCount)throw new SupportError('TICKET_UNAVAILABLE',404);
 const reference=source.rows[0].reference;
 const control:EngineeringControlInput=parsed.operation==='LIST'?{purpose:'LIST_TICKET_TASKS',sourceReference:reference,offset:parsed.offset}:{purpose:'CANCEL_TASK',sourceReference:reference,taskId:parsed.taskId,revision:parsed.revision};
 const attestation=signTaskControl(control,{founder:c.founder,personId:c.personId},key,deps.now());
 try{
  const response=await deps.fetch(new URL('/v1/engineering/task-control',origin),{method:'POST',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({attestation}),signal:AbortSignal.timeout(10000)});
  if(response.status===409)throw new SupportError('ENGINEERING_TASK_CHANGED',409);if(response.status===404)throw new SupportError('ENGINEERING_TASK_UNAVAILABLE',404);if(!response.ok)throw Error();
  const raw=JSON.parse(await boundedEngineeringText(response,32768));
  if(parsed.operation==='LIST'){const result=taskListSchema.parse(raw);if(result.tasks.some(t=>t.sourceReference!==reference)||(result.nextOffset!==null&&result.nextOffset!==parsed.offset+25))throw Error();return result;}
  const result=savedTaskSchema.parse(raw);if(result.task.id!==parsed.taskId||result.task.sourceReference!==reference||result.task.state!=='CANCELLED'||result.task.revision!==parsed.revision+1)throw Error();return result;
 }catch(error){if(error instanceof SupportError)throw error;throw new SupportError('ENGINEERING_LEDGER_UNAVAILABLE',503);}
}
