import {z} from "zod";
import {peosProxy} from "./peosProxy";
import {readServerEnvironment} from "../config/env";
import {PeosSessionResolver} from "../session/peosSessionResolver";
import {getDatabasePool} from "../db/pool";
import {connectCreatedClass} from "../../domains/workspace/service";
const id=z.string().uuid();
export async function createSchoolClass(request:Request,schoolId:string){
  const response=await peosProxy(request,`/v1/admin/schools/${encodeURIComponent(schoolId)}/classes`,await request.json().catch(()=>null));
  if(!response.ok)return response;
  const result=await response.json();let workspaceConnected=false;
  try{
    const session=await new PeosSessionResolver(readServerEnvironment().PEOS_BASE_URL!).resolve(request);
    if(session)workspaceConnected=await connectCreatedClass(getDatabasePool(),session.personId,id.parse(schoolId),id.parse(result.class.id));
  }catch{/* Class creation has committed in PEOS; report workspace setup separately. */}
  return Response.json({...result,workspaceConnected},{status:response.status,headers:{"cache-control":"no-store"}});
}
