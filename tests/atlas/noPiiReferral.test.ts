import assert from "node:assert/strict";
import test from "node:test";

import { createOpaqueAtlasReferral } from "../../domains/atlas/referral";

test("referral token does not encode caller supplied identity because API accepts none", () => {
  const referral = createOpaqueAtlasReferral(new Date("2026-09-05T00:00:00Z"));
  assert.equal(/[.@\s]/.test(referral.token), false);
  assert.equal(Object.keys(referral).sort().join(","), "expiresAt,token");
});
