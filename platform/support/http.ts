import {evidenceContentSchema} from '../../packages/engineering-control/evidence-record-contract';
import {repositoryInspectionInput} from '../../packages/engineering-control/repository-contract';
import {inspectFounderRepository} from './repositoryInspection';
import {z,ZodError} from "zod";
import type {Pool} from "pg";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {sameOrigin} from "../admin/peosProxy";
import {getDatabasePool} from "../db/pool";
import {supportAuthority,peosRead,directorySchema,schoolSchema} from "./authority";
import {assertFounder,assertMember,SupportError,id,ticketInput,replyInput,updateInput,recommendationInput,decisionInput,listQuery,type SupportContext} from "../../domains/support/contracts";
import {createTicket,listTickets,getTicket,replyTicket,updateTicket,prepareRecommendation,decideRecommendation} from "../../domains/support/service";
import {directoryHealth,schoolOperations} from "../../domains/support/operations";
import {handoffInput} from "../../packages/engineering-control/contracts";
import {prepareEngineeringHandoff} from "../../domains/support/engineering";
import {taskControlInput,controlEngineeringTask} from "./engineeringControl";
import {engineeringSaveInput,saveEngineeringTask,engineeringStorageStatus} from "./engineeringAdapter";
import {founderInsights} from "../../domains/support/insights";
type Deps={context:(request:Request)=>Promise<SupportContext>;pool:()=>Pool;peos:typeof peosRead};
const defaults:Deps={context:supportAuthority,pool:getDatabasePool,peos:peosRead};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
async function body(request:Request){const text=await request.text();if(new TextEncoder().encode(text).length>25000)throw new SupportError("INVALID_INPUT",400);return JSON.parse(text);}
async function handle(request:Request,run:()=>Promise<unknown>){
 try{if(request.method!=="GET"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);if(!resolvePeosAuthorization(request))return reply({error:"UNAUTHENTICATED"},401);return reply(await run());}
 catch(error){if(error instanceof SupportError)return reply({error:error.code},error.status);if(error instanceof ZodError||error instanceof SyntaxError)return reply({error:"INVALID_INPUT"},400);return reply({error:"SUPPORT_UNAVAILABLE"},503);}
}
export function supportHandler(deps:Deps=defaults){return (request:Request,ticketId?:string)=>handle(request,async()=>{
 const c=await deps.context(request);const target=ticketId?id.parse(ticketId):null;
 if(request.method==="GET"){
  if(target)return getTicket(deps.pool(),c,target);
  const query=listQuery.parse(Object.fromEntries(new URL(request.url).searchParams));if(query.schoolId)assertMember(c,query.schoolId);
  return {context:c,...(c.schools.length?await listTickets(deps.pool(),c,query):{tickets:[],nextOffset:null,pending:[]})};
 }
 if(request.method==="POST"){
  if(target)return replyTicket(deps.pool(),c,target,replyInput.parse(await body(request)));
  const input=ticketInput.parse(await body(request));assertMember(c,input.schoolId);return createTicket(deps.pool(),c,input);
 }
 throw new SupportError("METHOD_NOT_ALLOWED",405);
});}
const founderQuery=z.object({view:z.enum(["directory","school","tickets","ticket","insights"]).default("tickets"),q:z.string().trim().max(100).default(""),offset:z.coerce.number().int().min(0).max(1000000).default(0),schoolId:id.optional(),ticketId:id.optional(),status:z.enum(["SUBMITTED","UNDER_REVIEW","NEEDS_INFORMATION","PLANNED","RESOLVED","CLOSED"]).optional()}).strict();
const controlActions=[
 z.object({action:z.literal("SAVE_ENGINEERING_EVIDENCE"),ticketId:id,taskId:id,revision:z.number().int().nonnegative(),requestId:id,content:evidenceContentSchema}).strict(),
 z.object({action:z.literal("ENGINEERING_EVIDENCE"),ticketId:id,taskId:id}).strict(),
 z.object({action:z.literal("LINK_ENGINEERING_PR"),ticketId:id,taskId:id,revision:z.number().int().nonnegative(),pullRequest:z.number().int().positive().max(100000000),headCommit:z.string().regex(/^[a-f0-9]{40}$/)}).strict(),
 z.object({action:z.literal("ENGINEERING_LINKED_REVIEW"),ticketId:id,taskId:id}).strict(),
 z.object({action:z.literal("ENGINEERING_REVIEW_DECISION"),ticketId:id,taskId:id,revision:z.number().int().nonnegative(),requestId:id,reviewDigest:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['APPROVED','CHANGES_REQUESTED','DEFERRED','DECLINED'])}).strict(),
 z.object({action:z.literal("ENGINEERING_TASK_HISTORY"),ticketId:id,taskId:id}).strict(),
 z.object({action:z.literal("LIST_ENGINEERING_TASKS"),ticketId:id,offset:z.number().int().min(0).max(10000).default(0)}).strict(),
 z.object({action:z.literal("CANCEL_ENGINEERING_TASK"),ticketId:id,taskId:id,revision:z.number().int().nonnegative()}).strict(),
] as const;
const actionSchema=z.discriminatedUnion("action",[
 ...controlActions,
 repositoryInspectionInput.extend({action:z.literal("INSPECT_ENGINEERING_PR")}),
 handoffInput.extend({action:z.literal("ENGINEERING_HANDOFF")}),
 engineeringSaveInput.extend({action:z.literal("SAVE_ENGINEERING_TASK")}),
 updateInput.extend({action:z.literal("UPDATE_TICKET")}),
 recommendationInput.extend({action:z.literal("RECOMMENDATION")}),
 decisionInput.extend({action:z.literal("DECISION")}),
]);
export function founderHandler(deps:Deps=defaults){return (request:Request)=>handle(request,async()=>{
 const c=await deps.context(request);assertFounder(c);
 if(request.method==="GET"){
 const q=founderQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
 if(q.view==="insights")return founderInsights(deps.pool(),c);
 if(q.view==="directory"){
  const params=new URLSearchParams({q:q.q,offset:String(q.offset)});const canonical=await deps.peos(request,"/v1/spacecase/founder/schools?"+params,directorySchema);
  return {...canonical,health:await directoryHealth(deps.pool(),c,canonical.schools.map(s=>s.id))};
 }
 if(q.view==="school"){
  if(!q.schoolId)throw new SupportError("INVALID_INPUT",400);
  const canonical=await deps.peos(request,"/v1/spacecase/founder/schools/"+q.schoolId,schoolSchema);
  if(canonical.school.id!==q.schoolId)throw new SupportError("PEOS_UNAVAILABLE",503);
  return {...canonical,...await schoolOperations(deps.pool(),c,q.schoolId,canonical.classes.map(cl=>cl.id))};
 }
 if(q.view==="ticket"){if(!q.ticketId)throw new SupportError("INVALID_INPUT",400);return getTicket(deps.pool(),c,q.ticketId,true);}
 return listTickets(deps.pool(),c,{offset:q.offset,schoolId:q.schoolId,status:q.status},true);
 }
 if(request.method==="POST"){
 const input=actionSchema.parse(await body(request));
 if(input.action==="INSPECT_ENGINEERING_PR")return inspectFounderRepository(c,{pullRequest:input.pullRequest,expectedHeadCommit:input.expectedHeadCommit});
 if(input.action==="SAVE_ENGINEERING_EVIDENCE"||input.action==="ENGINEERING_EVIDENCE")return controlEngineeringTask(deps.pool(),c,taskControlInput.parse({operation:input.action==="SAVE_ENGINEERING_EVIDENCE"?"SAVE_EVIDENCE":"EVIDENCE",...Object.fromEntries(Object.entries(input).filter(([k])=>k!=="action"))}));
 if(input.action==="LINK_ENGINEERING_PR")return controlEngineeringTask(deps.pool(),c,taskControlInput.parse({operation:'LINK',...Object.fromEntries(Object.entries(input).filter(([k])=>k!=='action'))}));
 if(input.action==="ENGINEERING_LINKED_REVIEW")return controlEngineeringTask(deps.pool(),c,taskControlInput.parse({operation:'REVIEW',ticketId:input.ticketId,taskId:input.taskId}));
 if(input.action==="ENGINEERING_REVIEW_DECISION"){if(input.decision==='APPROVED')throw new SupportError('ENGINEERING_REVIEW_NOT_READY',409);return controlEngineeringTask(deps.pool(),c,taskControlInput.parse({operation:'DECIDE',...Object.fromEntries(Object.entries(input).filter(([k])=>k!=='action'))}));}
 if(input.action==="ENGINEERING_TASK_HISTORY")return controlEngineeringTask(deps.pool(),c,taskControlInput.parse({operation:'HISTORY',ticketId:input.ticketId,taskId:input.taskId}));
 if(input.action==="LIST_ENGINEERING_TASKS")return controlEngineeringTask(deps.pool(),c,taskControlInput.parse({operation:'LIST',ticketId:input.ticketId,offset:input.offset}));
 if(input.action==="CANCEL_ENGINEERING_TASK")return controlEngineeringTask(deps.pool(),c,taskControlInput.parse({operation:'CANCEL',ticketId:input.ticketId,taskId:input.taskId,revision:input.revision}));
 if(input.action==="SAVE_ENGINEERING_TASK")return saveEngineeringTask(deps.pool(),c,engineeringSaveInput.parse(Object.fromEntries(Object.entries(input).filter(([k])=>k!=="action"))));
 if(input.action==="ENGINEERING_HANDOFF"){return {...await prepareEngineeringHandoff(deps.pool(),c,handoffInput.parse(Object.fromEntries(Object.entries(input).filter(([k])=>k!=="action")))),storage:engineeringStorageStatus()};}
 if(input.action==="UPDATE_TICKET")return updateTicket(deps.pool(),c,updateInput.parse(Object.fromEntries(Object.entries(input).filter(([k])=>k!=="action"))));
 if(input.action==="RECOMMENDATION")return prepareRecommendation(deps.pool(),c,recommendationInput.parse(Object.fromEntries(Object.entries(input).filter(([k])=>k!=="action"))));
 return decideRecommendation(deps.pool(),c,decisionInput.parse(Object.fromEntries(Object.entries(input).filter(([k])=>k!=="action"))));
 }
 throw new SupportError("METHOD_NOT_ALLOWED",405);
});}
