import {z} from "zod";
import {id,SupportError,type SupportContext} from "../support/contracts";
const text=(min:number,max:number)=>z.string().trim().min(min).max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/);
const base=z.object({requestId:id,ticketId:id,revision:z.number().int().nonnegative()});
export const agentAction=z.discriminatedUnion("action",[
 base.extend({action:z.literal("CLAIM")}).strict(),
 base.extend({action:z.literal("RELEASE"),reason:text(10,500)}).strict(),
 base.extend({action:z.literal("REPLY"),message:text(1,2000),status:z.enum(["UNDER_REVIEW","NEEDS_INFORMATION"])}).strict(),
 base.extend({action:z.literal("ESCALATE"),reason:text(10,2000)}).strict(),
]);
export const founderWorkAction=z.discriminatedUnion("action",[
 base.extend({action:z.literal("ASSIGN"),ownerPersonId:id.nullable(),reason:text(10,500)}).strict(),
 base.extend({action:z.literal("ACKNOWLEDGE"),reason:text(10,500)}).strict(),
]);
export type WorkAction=z.infer<typeof agentAction>|z.infer<typeof founderWorkAction>;
export function assertAgent(c:SupportContext,schoolId?:string){if(!c.agentSchools?.length)throw new SupportError("SUPPORT_AGENT_REQUIRED");if(schoolId&&!c.agentSchools.some(s=>s.id===schoolId))throw new SupportError("AGENT_SCHOOL_REQUIRED");}
