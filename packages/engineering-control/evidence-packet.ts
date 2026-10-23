import {createHash} from 'node:crypto';
import {z} from 'zod';

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().trim().min(1).max(2000);
const bindingSchema = z.object({
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

export function collectEvidencePacket(input: unknown) {
  const packet = evidencePacketSchema.parse(input);
  const packetDigest = createHash('sha256').update(JSON.stringify(packet)).digest('hex');
  return {packet, packetDigest, verification: 'UNVERIFIED' as const,
    approvalAvailable: false as const, executionStarted: false as const, releasePermission: false as const};
}

// Server adapter output only. Never parse these records from browser request JSON as proof.
// GitHub numeric identities remain external identities; they are not fabricated PEOS UUIDs.
const receiptSchema = z.object({
  packetDigest: digest, binding: bindingSchema,
  review: z.object({authorGithubId: z.number().int().positive(), reviewerGithubId: z.number().int().positive(),
    reviewId: z.number().int().positive(), commit: sha, decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'PENDING']),
    threadsComplete: z.boolean(), unresolvedFindings: z.number().int().nonnegative(),
  }).strict(),
  reproduction: z.object({verifiedArtifactDigests: z.array(digest).max(10), result: z.enum(['PASS', 'FAIL', 'UNVERIFIED'])}).strict(),
  rollback: z.object({verifiedArtifactDigests: z.array(digest).max(10), reviewed: z.boolean()}).strict(),
}).strict();
export type EvidenceReceipt = z.infer<typeof receiptSchema>;
export type EvidenceVerifier = (packet: Readonly<EvidencePacket>, packetDigest: string) => Promise<EvidenceReceipt>;

export async function verifyEvidencePacket(input: unknown, context: {
  founder: boolean; binding: EvidenceBinding; sourceOpen: boolean; briefAvailable: boolean; taskState: 'BLOCKED' | 'CANCELLED';
}, verifier: EvidenceVerifier) {
  if (!context.founder) throw Error('FOUNDER_REQUIRED');
  const collected = collectEvidencePacket(input), current = bindingSchema.parse(context.binding);
  const blockers: string[] = [];
  if (JSON.stringify(collected.packet.binding) !== JSON.stringify(current)) blockers.push('EVIDENCE_BINDING_CHANGED');
  if (!context.sourceOpen) blockers.push('SOURCE_CLOSED');
  if (!context.briefAvailable) blockers.push('BRIEF_EXPIRED');
  if (context.taskState !== 'BLOCKED') blockers.push('TASK_CANCELLED');
  // Do not transmit a stale packet to an external adapter.
  if (blockers.length) return result();
  let receipt: EvidenceReceipt;
  try {
    // Give the adapter a detached copy so mutation cannot rewrite collected evidence.
    receipt = receiptSchema.parse(await verifier(JSON.parse(JSON.stringify(collected.packet)), collected.packetDigest));
  } catch { blockers.push('VERIFIER_UNAVAILABLE'); return result(); }
  if (receipt.packetDigest !== collected.packetDigest || JSON.stringify(receipt.binding) !== JSON.stringify(current)) {
    blockers.push('RECEIPT_BINDING_CHANGED'); return result();
  }
  if (receipt.review.commit !== current.headCommit) blockers.push('REVIEW_COMMIT_CHANGED');
  if (receipt.review.authorGithubId === receipt.review.reviewerGithubId) blockers.push('INDEPENDENT_REVIEW_REQUIRED');
  if (receipt.review.decision !== 'APPROVED') blockers.push('REVIEW_NOT_APPROVED');
  if (!receipt.review.threadsComplete) blockers.push('REVIEW_THREADS_UNVERIFIED');
  if (receipt.review.unresolvedFindings !== 0) blockers.push('REVIEW_FINDINGS_OPEN');
  if (receipt.reproduction.result !== 'PASS' || collected.packet.reproduction.acceptance.some(item => item.result !== 'PASS')) blockers.push('ACCEPTANCE_UNVERIFIED');
  if (!covered(collected.packet.reproduction.artifacts, receipt.reproduction.verifiedArtifactDigests)) blockers.push('REPRODUCTION_PROOF_UNVERIFIED');
  if (!receipt.rollback.reviewed || !covered(collected.packet.rollback.artifacts, receipt.rollback.verifiedArtifactDigests)) blockers.push('ROLLBACK_PROOF_UNVERIFIED');
  if (['UNKNOWN', 'IRREVERSIBLE'].includes(collected.packet.rollback.dataImpact)) blockers.push('ROLLBACK_DATA_IMPACT_REQUIRES_REVIEW');
  return result();

  function result() {
    return {packetDigest: collected.packetDigest, evidenceVerified: blockers.length === 0, blockers,
      // Workflow validation and the existing final readiness policy remain separate gates.
      approvalAvailable: false as const, executionStarted: false as const, releasePermission: false as const};
  }
}
function covered(artifacts: Array<{sha256: string}>, verified: string[]) {
  return artifacts.every(artifact => verified.includes(artifact.sha256));
}
