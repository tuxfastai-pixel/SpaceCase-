import {z} from 'zod';
export const savedTaskSchema=z.object({
 task:z.object({id:z.string().uuid(),project:z.literal('SPACECASE'),sourceReference:z.string().regex(/^SC-[A-F0-9]{12}$/),sourceRevision:z.number().int().nonnegative(),handoffDigest:z.string().regex(/^[a-f0-9]{64}$/),baseCommit:z.string().regex(/^[a-f0-9]{40}$/),state:z.enum(['BLOCKED','CANCELLED']),revision:z.number().int().nonnegative(),createdAt:z.string().datetime(),cancelledAt:z.string().datetime().nullable(),briefExpiresAt:z.string().datetime(),briefAvailable:z.boolean()}).strict(),
 executionStarted:z.literal(false),
}).strict();
export type SavedEngineeringTask=z.infer<typeof savedTaskSchema>;
