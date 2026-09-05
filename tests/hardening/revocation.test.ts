import assert from "node:assert/strict";
import test from "node:test";

import { authorityRemainsActive } from "../../domains/hardening/revocation";

const active = { sessionActive: true, consentActive: true, entitlementActive: true };

test("authority is lost immediately when any revocable condition is inactive", () => {
  assert.equal(authorityRemainsActive(active), true);
  assert.equal(authorityRemainsActive({ ...active, sessionActive: false }), false);
  assert.equal(authorityRemainsActive({ ...active, consentActive: false }), false);
  assert.equal(authorityRemainsActive({ ...active, entitlementActive: false }), false);
});
