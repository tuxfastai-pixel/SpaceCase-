import {z,ZodError} from "zod";
import type {Pool} from "pg";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {sameOrigin} from "../admin/peosProxy";
import {getDatabasePool} from "../db/pool";
import {supportAuthority,peosRead,schoolSchema} from "../support/authority";
import {SupportError,assertFounder,id,type SupportContext} from "../../domains/support/contracts";
import {billingAction} from "../../domains/billing/contracts";
import {readBilling,mutateBilling} from "../../domains/billing/service";
type Deps={context:(r:Request)=>Promise<SupportContext>;pool:()=>Pool;peos:typeof peosRead};
const defaults:Deps={context:supportAuthority,pool:getDatabasePool,peos:peosRead};
const adminClasses=z.object({classes:z.array(z.object({id}))});
export function billingHandler(deps:Deps=defaults){return async(request:Request,schoolId?:string)=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
 try{
 if(request.method!=="GET"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
 if(!resolvePeosAuthorization(request))return reply({error:"UNAUTHENTICATED"},401);
 const c=await deps.context(request);
 if(schoolId){
 schoolId=id.parse(schoolId);
 if(request.method!=="GET")return reply({error:"METHOD_NOT_ALLOWED"},405);
 // Fresh canonical administrator check; teachers cannot inherit billing access from support membership.
 await deps.peos(request,"/v1/admin/schools/"+schoolId+"/classes",adminClasses);
 return reply(await readBilling(deps.pool(),c,schoolId,false));
 }
 assertFounder(c);
 if(request.method==="GET"){
 const q=z.object({schoolId:id}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
 const school=await deps.peos(request,"/v1/spacecase/founder/schools/"+q.schoolId,schoolSchema);
 if(school.school.id!==q.schoolId)throw new SupportError("PEOS_UNAVAILABLE",503);
 return reply(await readBilling(deps.pool(),c,q.schoolId));
 }
 if(request.method==="POST"){
 const text=await request.text();if(new TextEncoder().encode(text).length>4000)throw new SupportError("INVALID_INPUT",400);
 const input=billingAction.parse(JSON.parse(text));
 if(input.action==="RECORD_INVOICE"){
 const school=await deps.peos(request,"/v1/spacecase/founder/schools/"+input.schoolId,schoolSchema);
 if(school.school.id!==input.schoolId)throw new SupportError("PEOS_UNAVAILABLE",503);
 }
 return reply(await mutateBilling(deps.pool(),c,input));
 }
 return reply({error:"METHOD_NOT_ALLOWED"},405);
 }catch(e){if(e instanceof SupportError)return reply({error:e.code},e.status);if(e instanceof ZodError||e instanceof SyntaxError)return reply({error:"INVALID_INPUT"},400);return reply({error:"BILLING_UNAVAILABLE"},503);}
};}
