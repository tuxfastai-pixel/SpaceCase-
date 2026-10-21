import assert from "node:assert/strict";
import test from "node:test";

import { createOpaqueAtlasReferral, referralIsActive } from "../../domains/atlas/referral";

test("Atlas referral token is opaque and short lived", () => {
  const now = new Date("2026-09-05T12:00:00Z");
  const referral = createOpaqueAtlasReferral(now, 30);
  assert.equal(referral.token.includes("@"), false);
  assert.equal(referral.token.length >= 40, true);
  assert.equal(referral.expiresAt.toISOString(), "2026-09-05T12:30:00.000Z");
  assert.equal(referralIsActive(referral.expiresAt, now), true);
});

test("Atlas referral TTL is bounded", () => {
  assert.throws(() => createOpaqueAtlasReferral(new Date(), 120));
});
