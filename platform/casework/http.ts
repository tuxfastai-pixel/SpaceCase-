import {z,ZodError} from "zod";
import type {Pool} from "pg";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {sameOrigin} from "../admin/peosProxy";
import {getDatabasePool} from "../db/pool";
import {supportAuthority,peosRead} from "../support/authority";
import {id,assertFounder,SupportError,type SupportContext} from "../../domains/support/contracts";
import {agentAction,founderWorkAction,assertAgent} from "../../domains/casework/contracts";
import {readWork,mutateWork,escalations} from "../../domains/casework/service";
const agentsSchema=z.object({agents:z.array(z.object({personId:id})),truncated:z.boolean()});
const query=z.object({ticketId:id.optional(),offset:z.coerce.number().int().min(0).max(1000000).default(0)}).strict();
type Deps={context:(r:Request)=>Promise<SupportContext>;pool:()=>Pool;peos:typeof peosRead};
const defaults:Deps={context:supportAuthority,pool:getDatabasePool,peos:peosRead};
export function caseworkHandler(founder=false,deps:Deps=defaults){return async(request:Request)=>{
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
 try{
 if(request.method!=="GET"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
 if(!resolvePeosAuthorization(request))return reply({error:"UNAUTHENTICATED"},401);
 const c=await deps.context(request);if(founder)assertFounder(c);else assertAgent(c);
 if(request.method==="GET"){
 const q=query.parse(Object.fromEntries(new URL(request.url).searchParams));
 if(q.ticketId){const data=await readWork(deps.pool(),c,q.ticketId,founder);return reply(founder?{...data,agents:(await deps.peos(request,"/v1/spacecase/founder/schools/"+data.ticket.schoolId+"/observers",agentsSchema)).agents}:data);}
 if(!founder)throw new SupportError("INVALID_INPUT",400);
 return reply(await escalations(deps.pool(),c,q.offset));
 }
 if(request.method==="POST"){
 const text=await request.text();if(new TextEncoder().encode(text).length>5000)throw new SupportError("INVALID_INPUT",400);
 if(founder){const input=founderWorkAction.parse(JSON.parse(text));let eligibleOwnerIds:string[]=[];
 if(input.action==="ASSIGN"&&input.ownerPersonId){const current=await readWork(deps.pool(),c,input.ticketId,true);const eligible=await deps.peos(request,"/v1/spacecase/founder/schools/"+current.ticket.schoolId+"/observers",agentsSchema);eligibleOwnerIds=eligible.agents.map(a=>a.personId);if(!eligibleOwnerIds.includes(input.ownerPersonId))throw new SupportError("ELIGIBLE_AGENT_REQUIRED",400);}
 return reply(await mutateWork(deps.pool(),c,input,true,eligibleOwnerIds));}
 return reply(await mutateWork(deps.pool(),c,agentAction.parse(JSON.parse(text))));
 }
 return reply({error:"METHOD_NOT_ALLOWED"},405);
 }catch(e){if(e instanceof SupportError)return reply({error:e.code},e.status);if(e instanceof ZodError||e instanceof SyntaxError)return reply({error:"INVALID_INPUT"},400);return reply({error:"CASEWORK_UNAVAILABLE"},503);}
};}
