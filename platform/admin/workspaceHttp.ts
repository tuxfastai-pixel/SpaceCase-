import {z,ZodError} from "zod";
import {readServerEnvironment} from "../config/env";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {PeosSessionResolver} from "../session/peosSessionResolver";
import {sameOrigin} from "./peosProxy";
import {getDatabasePool} from "../db/pool";
import {configureWorkspace,readWorkspace,workspaceSchema} from "../../domains/workspace/service";
const id=z.string().uuid().transform(v=>v.toLowerCase());
const directorySchema=z.object({classes:z.array(z.object({id}))});
export async function workspaceRequest(request:Request,schoolId:string){
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
  try{
    const env=readServerEnvironment();
    if(request.method!=="GET"&&!sameOrigin(request))return reply({error:"FORBIDDEN"},403);
    const authorization=resolvePeosAuthorization(request);
    if(!authorization)return reply({error:"UNAUTHENTICATED"},401);
    if(!env.PEOS_BASE_URL)return reply({error:"PEOS_UNAVAILABLE"},503);
    schoolId=id.parse(schoolId);
    const session=await new PeosSessionResolver(env.PEOS_BASE_URL).resolve(request);
    if(!session)return reply({error:"UNAUTHENTICATED"},401);
    // Get class IDs from the authority, never from the submitted setup form.
    const response=await fetch(new URL(`/v1/admin/schools/${schoolId}/classes`,env.PEOS_BASE_URL),{headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(10_000)});
    if(response.status===401||response.status===403)return reply({error:"SCHOOL_ADMIN_REQUIRED"},response.status);
    if(!response.ok)return reply({error:"PEOS_UNAVAILABLE"},503);
    const directory=directorySchema.parse(await response.json());
    const pool=getDatabasePool();
    if(request.method==="GET")return reply(await readWorkspace(pool,schoolId));
    const input=workspaceSchema.parse(await request.json().catch(()=>null));
    return reply(await configureWorkspace(pool,session.personId,schoolId,directory.classes.map(c=>c.id),input));
  }catch(error){
    if(error instanceof ZodError)return reply({error:"INVALID_INPUT"},400);
    return reply({error:"WORKSPACE_STORAGE_UNAVAILABLE"},503);
  }
}
