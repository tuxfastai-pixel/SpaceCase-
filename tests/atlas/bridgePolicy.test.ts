import assert from "node:assert/strict";
import test from "node:test";

import { authorizeAtlasBridge } from "../../domains/atlas/bridgePolicy";

const valid = {
  atlasEntitlementActive: true,
  guardianConsentActive: true,
  educatorAuthorized: true,
  purposePermitted: true,
  contractVersionCurrent: true,
};

test("Atlas bridge requires every authority condition", () => {
  assert.deepEqual(authorizeAtlasBridge(valid), { allowed: true, reason: "bridge_authorized" });
});

for (const key of Object.keys(valid) as Array<keyof typeof valid>) {
  test(`Atlas bridge denies when ${key} is false`, () => {
    const decision = authorizeAtlasBridge({ ...valid, [key]: false });
    assert.equal(decision.allowed, false);
  });
}
