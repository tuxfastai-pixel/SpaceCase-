import {z,ZodError} from 'zod';
import {FamilyDraftError,saveFamilyDraft} from '../../domains/family/contracts';
import {readFamilyDraft,writeFamilyDraft,clearFamilyDraft} from '../../domains/family/service';
import {sameOrigin} from '../admin/peosProxy';
import {boundedText} from '../http/boundedText';
import {resolvePeosAuthorization} from '../session/peosAuthorization';
import {PeosSessionResolver} from '../session/peosSessionResolver';
import {readServerEnvironment} from '../config/env';
import {getDatabasePool} from '../db/pool';
type Deps={session:(r:Request)=>Promise<{personId:string}|null>;read:(owner:string)=>Promise<unknown>;save:(owner:string,input:unknown)=>Promise<unknown>;clear:(owner:string,revision:number)=>Promise<unknown>};
export function familyDraftHandler(deps:Deps){return async(request:Request)=>{const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store'}});try{
 if(!['GET','POST','DELETE'].includes(request.method))return reply({error:'METHOD_NOT_ALLOWED'},405);
 if(request.method!=='GET'&&!sameOrigin(request))return reply({error:'FORBIDDEN'},403);
 if(!resolvePeosAuthorization(request))return reply({error:'UNAUTHENTICATED'},401);
 const session=await deps.session(request);if(!session)return reply({error:'UNAUTHENTICATED'},401);
 if(new URL(request.url).search)return reply({error:'INVALID_INPUT'},400);
 if(request.method==='DELETE'){const input=z.object({revision:z.number().int().positive().max(2147483647)}).strict().parse(JSON.parse(await boundedText(request,1000)));return reply(await deps.clear(session.personId,input.revision));}
 return reply(request.method==='GET'?await deps.read(session.personId):await deps.save(session.personId,saveFamilyDraft.parse(JSON.parse(await boundedText(request,40000)))));
 }catch(e){if(e instanceof FamilyDraftError)return reply({error:e.code},e.status);if(e instanceof ZodError||e instanceof SyntaxError||e instanceof RangeError)return reply({error:'INVALID_INPUT'},400);return reply({error:'FAMILY_DRAFT_UNAVAILABLE'},503);}};}
export async function familyDraftRequest(request:Request){const env=readServerEnvironment();if(!env.PEOS_BASE_URL||env.SPACECASE_WORKSPACE_MODE!=='operational')return Response.json({error:'FAMILY_DRAFT_UNAVAILABLE'},{status:503,headers:{'cache-control':'no-store'}});return familyDraftHandler({session:r=>new PeosSessionResolver(env.PEOS_BASE_URL!).resolve(r),read:owner=>readFamilyDraft(getDatabasePool(),owner),save:(owner,input)=>writeFamilyDraft(getDatabasePool(),owner,input),clear:(owner,revision)=>clearFamilyDraft(getDatabasePool(),owner,revision)})(request);}
