import assert from "node:assert/strict";
import test from "node:test";

import { authorizeAcceleratedAtlasOnboarding } from "../../domains/atlas/onboardingPolicy";
import { authorizeAtlasBridge } from "../../domains/atlas/bridgePolicy";
import { authorityRemainsActive } from "../../domains/hardening/revocation";

test("Atlas access stays denied after consent revocation even if other bridge conditions remain true", () => {
  const bridge = authorizeAtlasBridge({ atlasEntitlementActive: true, guardianConsentActive: false, educatorAuthorized: true, purposePermitted: true, contractVersionCurrent: true });
  assert.equal(bridge.allowed, false);
  assert.equal(authorityRemainsActive({ sessionActive: true, consentActive: false, entitlementActive: true }), false);
});

test("Atlas onboarding and bridge use separate scoped authority", () => {
  assert.equal(authorizeAcceleratedAtlasOnboarding({ guardianGrantActive: true, grantPurpose: "ATLAS_ACCELERATED_ONBOARDING", grantVersionCurrent: true, teacherAuthorized: true }), true);
  assert.equal(authorizeAtlasBridge({ atlasEntitlementActive: true, guardianConsentActive: false, educatorAuthorized: true, purposePermitted: true, contractVersionCurrent: true }).allowed, false);
});
