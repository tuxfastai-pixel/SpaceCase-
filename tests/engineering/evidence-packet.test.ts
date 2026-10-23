import test from 'node:test';
import assert from 'node:assert/strict';
import {collectEvidencePacket, verifyEvidencePacket, type EvidencePacket, type EvidenceReceipt} from '../../packages/engineering-control/evidence-packet';

const packet: EvidencePacket = {
  version: 'psg.engineering-evidence.v1', privacyReviewed: true,
  binding: {taskId: '12345678-1234-4234-8234-123456789012', taskRevision: 2, sourceReference: 'SC-123456ABCDEF', sourceRevision: 1,
    handoffDigest: 'a'.repeat(64), repository: 'tuxfastai-pixel/SpaceCase-', pullRequest: 38, baseCommit: 'b'.repeat(40), headCommit: 'c'.repeat(40)},
  reproduction: {steps: 'Open synthetic fixture', expected: 'One decision', before: 'Duplicate decision', after: 'One decision',
    acceptance: [{criterion: 'Retries preserve request identity', result: 'PASS'}], artifacts: [{kind: 'TEST_LOG', sha256: 'd'.repeat(64)}]},
  rollback: {plan: 'Restore previous deployment', trigger: 'Regression', verification: 'Health and authorization checks', dataImpact: 'NONE',
    artifacts: [{kind: 'ROLLBACK_PLAN', sha256: 'e'.repeat(64)}]},
};
const context = {founder: true, binding: packet.binding, sourceOpen: true, briefAvailable: true, taskState: 'BLOCKED' as const};
function receipt(): EvidenceReceipt {
  return {packetDigest: collectEvidencePacket(packet).packetDigest, binding: packet.binding,
    review: {authorGithubId: 100, reviewerGithubId: 200, reviewId: 300, commit: packet.binding.headCommit, decision: 'APPROVED', threadsComplete: true, unresolvedFindings: 0},
    reproduction: {result: 'PASS', verifiedArtifactDigests: ['d'.repeat(64)]}, rollback: {reviewed: true, verifiedArtifactDigests: ['e'.repeat(64)]}};
}
test('collection is deterministic, bounded, strict and never asserts verification or authority', () => {
  const first = collectEvidencePacket(packet);
  assert.deepEqual(collectEvidencePacket(JSON.parse(JSON.stringify(packet))), first);
  assert.equal(first.verification, 'UNVERIFIED'); assert.equal(first.approvalAvailable, false);
  for (const extra of [{verified: true}, {releasePermission: true}, {reviewerId: 'trusted'}]) assert.throws(() => collectEvidencePacket({...packet, ...extra}));
  assert.throws(() => collectEvidencePacket({...packet, privacyReviewed: false}));
  assert.throws(() => collectEvidencePacket({...packet, rollback: {...packet.rollback, plan: 'x'.repeat(2001)}}));
  assert.throws(() => collectEvidencePacket({...packet, binding: {...packet.binding, repository: 'another/repo'}}));
  assert.throws(() => collectEvidencePacket({...packet, reproduction: {...packet.reproduction, artifacts: [{kind: 'TEST_LOG', url: 'https://untrusted'}]}}));
});
test('fresh exact-head proof can pass evidence verification without granting approval or release', async () => {
  const verified = await verifyEvidencePacket(packet, context, async () => receipt());
  assert.equal(verified.evidenceVerified, true); assert.deepEqual(verified.blockers, []);
  assert.equal(verified.approvalAvailable, false); assert.equal(verified.releasePermission, false); assert.equal(verified.executionStarted, false);
});
test('authorization, lifecycle and every binding field fail before calling the adapter', async () => {
  let calls = 0; const verifier = async () => {calls++; return receipt();};
  await assert.rejects(verifyEvidencePacket(packet, {...context, founder: false}, verifier), /FOUNDER_REQUIRED/);
  for (const [key, value] of Object.entries({taskId: '22345678-1234-4234-8234-123456789012', taskRevision: 3, sourceReference: 'SC-FFFFFFFFFFFF', sourceRevision: 2,
    handoffDigest: 'f'.repeat(64), pullRequest: 39, baseCommit: 'f'.repeat(40), headCommit: 'f'.repeat(40)})) {
    const result = await verifyEvidencePacket(packet, {...context, binding: {...context.binding, [key]: value}}, verifier);
    assert.deepEqual(result.blockers, ['EVIDENCE_BINDING_CHANGED']);
  }
  for (const change of [{sourceOpen: false}, {briefAvailable: false}, {taskState: 'CANCELLED' as const}]) {
    assert.equal((await verifyEvidencePacket(packet, {...context, ...change}, verifier)).evidenceVerified, false);
  }
  assert.equal(calls, 0);
});
test('stale receipts, self review, incomplete threads, open findings and missing proof cannot pass', async () => {
  const changes: Array<Partial<EvidenceReceipt>> = [
    {packetDigest: 'f'.repeat(64)}, {binding: {...packet.binding, sourceRevision: 2}},
    ...[{commit: 'f'.repeat(40)}, {reviewerGithubId: 100}, {decision: 'PENDING' as const}, {threadsComplete: false}, {unresolvedFindings: 1}].map(delta => ({review: {...receipt().review, ...delta}})),
    {reproduction: {result: 'FAIL', verifiedArtifactDigests: ['d'.repeat(64)]}},
    {reproduction: {result: 'PASS', verifiedArtifactDigests: []}}, {rollback: {reviewed: false, verifiedArtifactDigests: ['e'.repeat(64)]}},
    {rollback: {reviewed: true, verifiedArtifactDigests: []}},
  ];
  for (const change of changes) assert.equal((await verifyEvidencePacket(packet, context, async () => ({...receipt(), ...change}))).evidenceVerified, false);
  assert.deepEqual((await verifyEvidencePacket(packet, context, async () => {throw Error('private secret');})).blockers, ['VERIFIER_UNAVAILABLE']);
});
test('claimed passing receipts cannot conceal failed acceptance or unsafe rollback impact', async () => {
  for (const changed of [
    {...packet, reproduction: {...packet.reproduction, acceptance: [{criterion: 'Not tested', result: 'NOT_RUN' as const}]}},
    {...packet, rollback: {...packet.rollback, dataImpact: 'UNKNOWN' as const}},
    {...packet, rollback: {...packet.rollback, dataImpact: 'IRREVERSIBLE' as const}},
  ]) {
    const result = await verifyEvidencePacket(changed, context, async () => ({...receipt(), packetDigest: collectEvidencePacket(changed).packetDigest}));
    assert.equal(result.evidenceVerified, false);
  }
});
test('adapter mutation cannot rewrite the collected packet', async () => {
  const result = await verifyEvidencePacket(packet, context, async copy => {
    copy.binding.headCommit = 'f'.repeat(40);
    return receipt();
  });
  assert.equal(result.evidenceVerified, true); assert.equal(packet.binding.headCommit, 'c'.repeat(40));
});
