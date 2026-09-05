import assert from "node:assert/strict";
import test from "node:test";

import { authorizeAcceleratedAtlasOnboarding } from "../../domains/atlas/onboardingPolicy";

const valid = { guardianGrantActive: true, grantPurpose: "ATLAS_ACCELERATED_ONBOARDING" as const, grantVersionCurrent: true, teacherAuthorized: true };

test("accelerated Atlas onboarding requires explicit scoped current grant", () => {
  assert.equal(authorizeAcceleratedAtlasOnboarding(valid), true);
  assert.equal(authorizeAcceleratedAtlasOnboarding({ ...valid, guardianGrantActive: false }), false);
  assert.equal(authorizeAcceleratedAtlasOnboarding({ ...valid, grantPurpose: "OTHER" }), false);
  assert.equal(authorizeAcceleratedAtlasOnboarding({ ...valid, grantVersionCurrent: false }), false);
  assert.equal(authorizeAcceleratedAtlasOnboarding({ ...valid, teacherAuthorized: false }), false);
});
