import {z,ZodError} from "zod";
import type {Pool} from "pg";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {supportAuthority} from "../support/authority";
import {getDatabasePool} from "../db/pool";
import {SupportError,id,type SupportContext} from "../../domains/support/contracts";
import {observerQueue} from "../../domains/operations/service";
const query=z.object({schoolId:id.optional(),offset:z.coerce.number().int().min(0).max(1000000).default(0)}).strict();
export function operationsHandler(deps={context:supportAuthority as (r:Request)=>Promise<SupportContext>,pool:getDatabasePool as ()=>Pool}){return async(request:Request)=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
 try{
 if(!resolvePeosAuthorization(request))return reply({error:"UNAUTHENTICATED"},401);
 if(request.method!=="GET")return reply({error:"METHOD_NOT_ALLOWED"},405);
 const c=await deps.context(request);const q=query.parse(Object.fromEntries(new URL(request.url).searchParams));
 // Permission checks precede even acquiring the product database pool.
 if(!c.observerSchools?.length)throw new SupportError("OBSERVER_REQUIRED");
 if(q.schoolId&&!c.observerSchools.some(s=>s.id===q.schoolId))throw new SupportError("OBSERVER_SCHOOL_REQUIRED");
 return reply(await observerQueue(deps.pool(),c,q.schoolId,q.offset));
 }catch(e){if(e instanceof SupportError)return reply({error:e.code},e.status);if(e instanceof ZodError)return reply({error:"INVALID_INPUT"},400);return reply({error:"OPERATIONS_UNAVAILABLE"},503);}
};}
