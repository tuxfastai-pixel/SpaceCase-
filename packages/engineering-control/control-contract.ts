import {z} from 'zod';
import {savedTaskSchema} from './result';
const reference=z.string().regex(/^SC-[A-F0-9]{12}$/);
export const controlInputSchema=z.discriminatedUnion('purpose',[
 z.object({purpose:z.literal('LIST_TICKET_TASKS'),sourceReference:reference,offset:z.number().int().min(0).max(10000).default(0)}).strict(),
 z.object({purpose:z.literal('READ_TASK_HISTORY'),sourceReference:reference,taskId:z.string().uuid()}).strict(),
 z.object({purpose:z.literal('CANCEL_TASK'),sourceReference:reference,taskId:z.string().uuid(),revision:z.number().int().nonnegative()}).strict(),
]);
export type EngineeringControlInput=z.infer<typeof controlInputSchema>;
export const taskListSchema=z.object({tasks:z.array(savedTaskSchema.shape.task).max(25),nextOffset:z.number().int().min(0).max(10000).nullable(),executionStarted:z.literal(false)}).strict();
export type EngineeringTaskList=z.infer<typeof taskListSchema>;

export const taskHistorySchema=z.object({taskId:z.string().uuid(),sourceReference:reference,events:z.array(z.object({id:z.string().uuid(),kind:z.enum(['CREATED','CANCELLED','BRIEF_EXPIRED']),revision:z.number().int().nonnegative(),occurredAt:z.string().datetime()}).strict()).max(25),truncated:z.boolean(),executionStarted:z.literal(false)}).strict();
export type EngineeringTaskHistory=z.infer<typeof taskHistorySchema>;
