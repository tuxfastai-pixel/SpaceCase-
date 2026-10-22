import {z} from "zod";
import {attendanceDate} from "../attendance/contracts";
export class ObservationError extends Error{constructor(public code:string,public status=403){super(code);}}
export const observationId=z.string().uuid().transform(v=>v.toLowerCase());
const text=(max:number,min=0)=>z.string().trim().min(min).max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),"Remove unsupported characters");
export const observationKind=z.enum(["POSITIVE","LEARNING_SUPPORT","BEHAVIOUR_SUPPORT"]);
export const observationState=z.enum(["OPEN","RESOLVED","RETRACTED"]);
export const observationFields=z.object({kind:observationKind,observedDate:attendanceDate,context:text(160,1),evidence:text(3000,1),response:text(2000),nextStep:text(2000),followUpDate:attendanceDate.nullable()}).strict().refine(v=>!v.followUpDate||v.followUpDate>=v.observedDate,{path:["followUpDate"],message:"Choose a follow-up date on or after the observation date"});
const revision=z.number().int().min(1).max(2147483646);
const changeReason=z.enum(["ENTRY_CORRECTION","NEW_INFORMATION","FOLLOW_UP"]);
export const observationInput=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE"),recordId:observationId,learnerId:observationId,fields:observationFields}).strict(),
 z.object({action:z.literal("EDIT"),recordId:observationId,revision,reason:changeReason,fields:observationFields}).strict(),
 z.object({action:z.literal("RESOLVE"),recordId:observationId,revision,outcome:text(2000,1)}).strict(),
 z.object({action:z.literal("REOPEN"),recordId:observationId,revision,reason:changeReason}).strict(),
 z.object({action:z.literal("RETRACT"),recordId:observationId,revision,reason:z.enum(["ENTRY_ERROR","DUPLICATE_RECORD"])}).strict(),
]);
export const observationQuery=z.object({record:observationId.optional(),learner:observationId.optional(),state:observationState.optional(),offset:z.coerce.number().int().min(0).max(10000).default(0)}).strict();
export type ObservationInput=z.infer<typeof observationInput>;
export type ObservationFields=z.infer<typeof observationFields>;
export type ObservationQuery=z.infer<typeof observationQuery>;
export type ObservationRecord=ObservationFields&{id:string;learnerId:string;state:z.infer<typeof observationState>;outcome:string;revision:number;updatedAt:string};
