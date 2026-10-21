import {z} from "zod";
import {SupportError,type SupportContext} from "../../domains/support/contracts";
import {resolvePeosAuthorization} from "../session/peosAuthorization";
import {readServerEnvironment} from "../config/env";
const id=z.string().uuid().transform(v=>v.toLowerCase());
export const contextSchema=z.object({personId:id,founder:z.boolean(),agentSchools:z.array(z.object({id,displayName:z.string()})).max(200).default([]),observerSchools:z.array(z.object({id,displayName:z.string()})).max(200).default([]),schools:z.array(z.object({id,displayName:z.string()}))});
export const schoolSummary=z.object({id,displayName:z.string(),status:z.enum(["ACTIVE","INACTIVE"]),createdAt:z.string(),classCount:z.number().int().nonnegative(),staffCount:z.number().int().nonnegative(),learnerCount:z.number().int().nonnegative(),pendingInvitations:z.number().int().nonnegative()});
export const directorySchema=z.object({schools:z.array(schoolSummary).max(50),nextOffset:z.number().int().nullable(),asOf:z.string()});
export const schoolSchema=z.object({school:schoolSummary,classes:z.array(z.object({id,name:z.string(),academicYear:z.number().int().nullable(),assignedTeachers:z.number().int().nonnegative()})).max(200),classesTruncated:z.boolean(),asOf:z.string()});
export async function peosRead<T>(request:Request,path:string,schema:z.ZodType<T>,fetchImpl:typeof fetch=fetch):Promise<T>{
 const authorization=resolvePeosAuthorization(request);if(!authorization)throw new SupportError("UNAUTHENTICATED",401);
 const env=readServerEnvironment();if(!env.PEOS_BASE_URL)throw new SupportError("PEOS_UNAVAILABLE",503);
 try{
 const r=await fetchImpl(new URL(path,env.PEOS_BASE_URL),{headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(r.status===401)throw new SupportError("UNAUTHENTICATED",401);if(r.status===403)throw new SupportError("ACCESS_REQUIRED");if(r.status===404)throw new SupportError("SCHOOL_UNAVAILABLE",404);
 if(!r.ok)throw new SupportError("PEOS_UNAVAILABLE",503);
 const parsed=schema.safeParse(await r.json());if(!parsed.success)throw new SupportError("PEOS_UNAVAILABLE",503);return parsed.data;
 }catch(error){if(error instanceof SupportError)throw error;throw new SupportError("PEOS_UNAVAILABLE",503);}
}
export async function supportAuthority(request:Request):Promise<SupportContext>{return peosRead(request,"/v1/spacecase/support/context",contextSchema);}
