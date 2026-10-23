import {z} from 'zod';

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().trim().min(1).max(2000);
export const bindingSchema = z.object({
  taskId: z.string().uuid(), taskRevision: z.number().int().nonnegative(),
  sourceReference: z.string().regex(/^SC-[A-F0-9]{12}$/),
  sourceRevision: z.number().int().nonnegative(), handoffDigest: digest,
  repository: z.literal('tuxfastai-pixel/SpaceCase-'),
  pullRequest: z.number().int().positive().max(100000000), baseCommit: sha, headCommit: sha,
}).strict();

// Content hashes identify proof without accepting arbitrary URLs or uploading school records.
const artifactSchema = z.object({sha256: digest, kind: z.enum(['TEST_LOG', 'SCREENSHOT', 'ROLLBACK_PLAN'])}).strict();
export const evidencePacketSchema = z.object({
  version: z.literal('psg.engineering-evidence.v1'), binding: bindingSchema,
  privacyReviewed: z.literal(true),
  reproduction: z.object({steps: text, expected: text, before: text, after: text,
    acceptance: z.array(z.object({criterion: text, result: z.enum(['PASS', 'FAIL', 'NOT_RUN'])}).strict()).min(1).max(20),
    artifacts: z.array(artifactSchema).min(1).max(10).refine(items => items.every(item => item.kind !== 'ROLLBACK_PLAN'), 'Reproduction requires test logs or screenshots'),
  }).strict(),
  rollback: z.object({plan: text, trigger: text, verification: text,
    dataImpact: z.enum(['NONE', 'REVERSIBLE', 'IRREVERSIBLE', 'UNKNOWN']),
    artifacts: z.array(artifactSchema).min(1).max(10).refine(items => items.some(item => item.kind === 'ROLLBACK_PLAN'), 'A rollback plan artifact is required'),
  }).strict(),
}).strict();
export type EvidencePacket = z.infer<typeof evidencePacketSchema>;
export type EvidenceBinding = z.infer<typeof bindingSchema>;

