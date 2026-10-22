import {z} from 'zod';
import type {Pool} from 'pg';
import {assertFounder,SupportError,type SupportContext} from '../../domains/support/contracts';
import {prepareEngineeringHandoff} from '../../domains/support/engineering';
import {handoffInput} from '../../packages/engineering-control/contracts';
import {boundedEngineeringText,engineeringSigningKey,savedTaskSchema,signTaskSave} from '../../packages/engineering-control/transport';
export const engineeringSaveInput=handoffInput.extend({requestId:z.string().uuid(),baseCommit:z.string().regex(/^[a-f0-9]{40}$/),consentToStore:z.literal(true)}).strict();
type Deps={env:()=>Readonly<Record<string,string|undefined>>;fetch:typeof fetch;now:()=>number};
const defaults:Deps={env:()=>process.env,fetch,now:()=>Math.floor(Date.now()/1000)};
export async function saveEngineeringTask(pool:Pool,c:SupportContext,input:z.infer<typeof engineeringSaveInput>,deps:Deps=defaults){
 assertFounder(c);const parsed=engineeringSaveInput.parse(input),env=deps.env();
 if(env.VERCEL_ENV!=='production'||env.SPACECASE_ENGINEERING_LEDGER_ENABLED!=='true'||!env.PSG_ENGINEERING_BASE_URL||!env.SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY)throw new SupportError('ENGINEERING_LEDGER_DISABLED',503);
 let origin:URL,key;
 try{
  origin=new URL(env.PSG_ENGINEERING_BASE_URL);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('INVALID_ORIGIN');
  key=engineeringSigningKey(env.SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY);
 }catch{throw new SupportError('ENGINEERING_LEDGER_DISABLED',503);}
 const packet=await prepareEngineeringHandoff(pool,c,handoffInput.parse({ticketId:parsed.ticketId,revision:parsed.revision,brief:parsed.brief,privacyReviewed:parsed.privacyReviewed}));
 const attestation=signTaskSave({requestId:parsed.requestId,request:{handoff:packet.handoff,digest:packet.digest,baseCommit:parsed.baseCommit}},{personId:c.personId,founder:c.founder,sourceRevision:packet.handoff.source.revision,sourceOpen:true},key,deps.now());
 try{
  // Only the purpose-scoped signed request leaves the product. No cookies or bearer session.
  const response=await deps.fetch(new URL('/v1/engineering/tasks',origin),{method:'POST',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({attestation}),signal:AbortSignal.timeout(10000)});
  if(response.status===409)throw new SupportError('ENGINEERING_REQUEST_CONFLICT',409);
  if(!response.ok)throw new Error('LEDGER_UNAVAILABLE');
  const result=savedTaskSchema.parse(JSON.parse(await boundedEngineeringText(response,4096)));
  if(result.task.sourceReference!==packet.handoff.source.reference||result.task.sourceRevision!==packet.handoff.source.revision||result.task.handoffDigest!==packet.digest||result.task.baseCommit!==parsed.baseCommit)throw new Error('LEDGER_BINDING_MISMATCH');
  return result;
 }catch(error){if(error instanceof SupportError)throw error;throw new SupportError('ENGINEERING_LEDGER_UNAVAILABLE',503);}
}

export function engineeringStorageStatus(env:Readonly<Record<string,string|undefined>>=process.env){
 try{const url=new URL(env.PSG_ENGINEERING_BASE_URL??'');
  const available=env.VERCEL_ENV==='production'&&env.SPACECASE_ENGINEERING_LEDGER_ENABLED==='true'&&url.protocol==='https:'&&url.pathname==='/'&&!url.username&&!url.password&&!url.search&&!url.hash&&Boolean(engineeringSigningKey(env.SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY??''));
  return {available,retentionDays:7 as const,baseCommit:/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA??'')?env.VERCEL_GIT_COMMIT_SHA:undefined};
 }catch{return {available:false,retentionDays:7 as const};}
}
