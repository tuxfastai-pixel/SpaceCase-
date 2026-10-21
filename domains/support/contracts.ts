import {z} from "zod";
const text=(min:number,max:number)=>z.string().trim().min(min).max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/);
export const ticketStatus=z.enum(["SUBMITTED","UNDER_REVIEW","NEEDS_INFORMATION","PLANNED","RESOLVED","CLOSED"]);
export const ticketPriority=z.enum(["LOW","NORMAL","HIGH","URGENT"]);
export const id=z.string().uuid().transform(v=>v.toLowerCase());
export const ticketInput=z.object({requestId:id,schoolId:id,category:z.enum(["BUG","EXPERIENCE","SUGGESTION"]),impact:z.enum(["BLOCKED","DEGRADED","IDEA"]),area:z.enum(["DASHBOARD","ATTENDANCE","ROSTER","SCHOOL_ADMIN","OTHER"]),title:text(3,120),description:text(10,4000)}).strict();
export const replyInput=z.object({revision:z.number().int().min(0),message:text(1,2000),reopen:z.boolean().default(false)}).strict();
export const updateInput=z.object({ticketId:id,revision:z.number().int().min(0),status:ticketStatus,priority:ticketPriority,message:text(1,2000)}).strict();
export const recommendationInput=z.object({ticketId:id,summary:text(10,2000),benefit:text(5,1500),risks:text(5,1500),validation:text(5,2000),rollback:text(5,1500),changeUrl:z.union([z.literal(""),z.string().url().max(500).refine(v=>{const u=new URL(v);return u.protocol==="https:"&&u.hostname==="github.com"&&/^\/tuxfastai-pixel\/(SpaceCase-|PEOS)\/pull\/\d+$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password;})])}).strict();
export const decisionInput=z.object({proposalId:id,decision:z.enum(["APPROVED","CHANGES_REQUESTED","DEFERRED","DECLINED"]),reason:text(5,1500)}).strict();
export const listQuery=z.object({status:ticketStatus.optional(),schoolId:id.optional(),offset:z.coerce.number().int().min(0).max(1000000).default(0)}).strict();
export type SupportContext={personId:string;founder:boolean;observerSchools?:Array<{id:string;displayName:string}>;schools:Array<{id:string;displayName:string}>};
export class SupportError extends Error{constructor(public code:string,public status=403){super(code);}}
export function assertFounder(context:SupportContext){if(!context.founder)throw new SupportError("FOUNDER_REQUIRED");}
export function assertMember(context:SupportContext,schoolId:string){if(!context.schools.some(s=>s.id===schoolId))throw new SupportError("SCHOOL_ACCESS_REQUIRED");}
