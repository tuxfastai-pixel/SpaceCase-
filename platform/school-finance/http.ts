import {z,ZodError} from 'zod';import type {Pool} from 'pg';import {getDatabasePool} from '../db/pool';import {sameOrigin} from '../admin/peosProxy';import {resolvePeosAuthorization} from '../session/peosAuthorization';import {PeosSessionResolver} from '../session/peosSessionResolver';import {readServerEnvironment} from '../config/env';import {boundedText} from '../http/boundedText';import {peosRead} from '../support/authority';import {SupportError} from '../../domains/support/contracts';import {financeCommand,financeContextSchema,financeId,FinanceError,assertFinanceContext,type FinanceContext} from '../../domains/school-finance/contracts';import {SchoolFinanceError} from '../../domains/school-finance/money';import {readFinance,mutateFinance} from '../../domains/school-finance/service';import type {AuthenticatedSession} from '../session/contracts';
type Deps={session:(r:Request)=>Promise<AuthenticatedSession|null>;context:(r:Request,schoolId:string,learnerPersonId?:string)=>Promise<FinanceContext>;pool:()=>Pool};
const defaults:Deps={session:async r=>{const env=readServerEnvironment();if(!env.PEOS_BASE_URL)throw new FinanceError('FINANCE_AUTHORITY_UNAVAILABLE',503);return new PeosSessionResolver(env.PEOS_BASE_URL).resolve(r);},context:(r,schoolId,learnerPersonId)=>peosRead(r,'/v1/spacecase/finance/schools/'+schoolId+'/context'+(learnerPersonId?'?learnerPersonId='+learnerPersonId:''),financeContextSchema),pool:getDatabasePool};
export function financeHandler(deps:Deps=defaults){return async(request:Request,schoolId:string)=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 try{
  if(request.method!=='GET'&&request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
  if(request.method!=='GET'&&!sameOrigin(request))return reply({error:'FORBIDDEN'},403);
  if(!resolvePeosAuthorization(request))return reply({error:'UNAUTHENTICATED'},401);
  schoolId=financeId.parse(schoolId);
  let body:unknown=null;if(request.method==='POST'){let raw:string;try{raw=await boundedText(request,32768);}catch{throw new FinanceError('INVALID_INPUT',400);}body=JSON.parse(raw);}
  const input=request.method==='POST'?financeCommand.parse(body):null;
  const query=request.method==='GET'?z.object({accountId:financeId.optional(),offset:z.coerce.number().int().min(0).max(1000000).default(0)}).strict().parse(Object.fromEntries(new URL(request.url).searchParams)):null;
  const session=await deps.session(request);if(!session)return reply({error:'UNAUTHENTICATED'},401);
  const c=await deps.context(request,schoolId,input?.action==='CREATE_ACCOUNT'?input.learnerPersonId:undefined);assertFinanceContext(c,schoolId);if(c.personId!==session.personId)throw new FinanceError('FINANCE_AUTHORITY_UNAVAILABLE',503);
  if(request.method==='GET')return reply({...await readFinance(deps.pool(),c,query!.accountId,query!.offset),authority:c});
  return reply(await mutateFinance(deps.pool(),c,input));
 }catch(e){if(e instanceof FinanceError)return reply({error:e.code},e.status);if(e instanceof SupportError)return reply({error:e.status===403?'SCHOOL_FINANCE_REQUIRED':e.code},e.status);if(e instanceof ZodError||e instanceof SyntaxError)return reply({error:'INVALID_INPUT'},400);if(e instanceof SchoolFinanceError)return reply({error:e.message},409);return reply({error:'SCHOOL_FINANCE_UNAVAILABLE'},503);}
};}
