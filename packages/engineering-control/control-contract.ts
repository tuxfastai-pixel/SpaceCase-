import {z} from 'zod';
import {evidenceContentSchema} from './evidence-record-contract';
import {savedTaskSchema} from './result';
const reference=z.string().regex(/^SC-[A-F0-9]{12}$/);
export const controlInputSchema=z.discriminatedUnion('purpose',[
 z.object({purpose:z.literal('SAVE_EVIDENCE'),sourceReference:reference,taskId:z.string().uuid(),revision:z.number().int().nonnegative(),requestId:z.string().uuid(),content:evidenceContentSchema,sourceRevision:z.number().int().nonnegative(),sourceOpen:z.boolean()}).strict(),
 z.object({purpose:z.literal('LIST_EVIDENCE'),sourceReference:reference,taskId:z.string().uuid()}).strict(),
 z.object({purpose:z.literal('LIST_TICKET_TASKS'),sourceReference:reference,offset:z.number().int().min(0).max(10000).default(0)}).strict(),
 z.object({purpose:z.literal('READ_TASK_HISTORY'),sourceReference:reference,taskId:z.string().uuid()}).strict(),
 z.object({purpose:z.literal('LINK_PULL_REQUEST'),sourceReference:reference,taskId:z.string().uuid(),revision:z.number().int().nonnegative(),pullRequest:z.number().int().positive().max(100000000),headCommit:z.string().regex(/^[a-f0-9]{40}$/),sourceRevision:z.number().int().nonnegative(),sourceOpen:z.boolean()}).strict(),
 z.object({purpose:z.literal('READ_LINKED_REVIEW'),verificationVersion:z.literal('github.v1').optional(),sourceReference:reference,taskId:z.string().uuid(),sourceRevision:z.number().int().nonnegative(),sourceOpen:z.boolean()}).strict(),
 z.object({purpose:z.literal('RECORD_REVIEW_DECISION'),sourceReference:reference,taskId:z.string().uuid(),revision:z.number().int().nonnegative(),requestId:z.string().uuid(),reviewDigest:z.string().regex(/^[a-f0-9]{64}$/),evidenceId:z.string().uuid().optional(),decision:z.enum(['APPROVED','CHANGES_REQUESTED','DEFERRED','DECLINED']),sourceRevision:z.number().int().nonnegative(),sourceOpen:z.boolean()}).strict(),
 z.object({purpose:z.literal('CANCEL_TASK'),sourceReference:reference,taskId:z.string().uuid(),revision:z.number().int().nonnegative()}).strict(),
]);
export type EngineeringControlInput=z.infer<typeof controlInputSchema>;
export const taskListSchema=z.object({tasks:z.array(savedTaskSchema.shape.task).max(25),nextOffset:z.number().int().min(0).max(10000).nullable(),executionStarted:z.literal(false)}).strict();
export type EngineeringTaskList=z.infer<typeof taskListSchema>;

export const taskHistorySchema=z.object({taskId:z.string().uuid(),sourceReference:reference,events:z.array(z.object({id:z.string().uuid(),kind:z.enum(['CREATED','CANCELLED','BRIEF_EXPIRED','PR_LINKED','DECISION_RECORDED','EVIDENCE_SUBMITTED']),revision:z.number().int().nonnegative(),occurredAt:z.string().datetime()}).strict()).max(25),truncated:z.boolean(),executionStarted:z.literal(false)}).strict();
export type EngineeringTaskHistory=z.infer<typeof taskHistorySchema>;
