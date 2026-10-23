import {z} from 'zod';
import {evidencePacketSchema} from './evidence-contract';
const id=z.string().uuid(),digest=z.string().regex(/^[a-f0-9]{64}$/),reference=z.string().regex(/^SC-[A-F0-9]{12}$/);
const short=z.string().trim().min(1).max(500);
export const evidenceContentSchema=evidencePacketSchema.pick({privacyReviewed:true,reproduction:true,rollback:true}).extend({
 reproduction:evidencePacketSchema.shape.reproduction.extend({steps:short,expected:short,before:short,after:short,acceptance:z.array(z.object({criterion:short,result:z.enum(['PASS','FAIL','NOT_RUN'])}).strict()).min(1).max(10)}),
 rollback:evidencePacketSchema.shape.rollback.extend({plan:short,trigger:short,verification:short}),
}).strict();
export const saveEvidenceSchema=z.object({taskId:id,sourceReference:reference,revision:z.number().int().nonnegative(),requestId:id,content:evidenceContentSchema}).strict();
export const evidenceRecordSchema=z.object({id,taskId:id,sourceReference:reference,requestId:id,submittedRevision:z.number().int().nonnegative(),recordedRevision:z.number().int().positive(),packetDigest:digest,headCommit:z.string().regex(/^[a-f0-9]{40}$/),recordedAt:z.string().datetime(),expiresAt:z.string().datetime(),verification:z.literal('UNVERIFIED'),executionStarted:z.literal(false),releasePermission:z.literal(false)}).strict();
export const evidenceListSchema=z.object({taskId:id,sourceReference:reference,records:z.array(evidenceRecordSchema.extend({packet:evidencePacketSchema.nullable()})).max(5),executionStarted:z.literal(false)}).strict();
export type EvidenceRecord=z.infer<typeof evidenceRecordSchema>;
