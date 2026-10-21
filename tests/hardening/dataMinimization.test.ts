import assert from "node:assert/strict";
import test from "node:test";

import { assertMinimizedIntegrationPayload } from "../../domains/hardening/dataMinimization";

test("bounded educational outcomes are allowed", () => {
  assert.doesNotThrow(() => assertMinimizedIntegrationPayload({ learnerPersonId: "opaque-id", supportOutcome: "continue_scaffolded_practice" }));
});

for (const field of ["growthDna", "rawConversation", "rawReflection", "familyDiscussion", "diagnosis", "password", "credential"]) {
  test(`cross-product payload rejects ${field}`, () => {
    assert.throws(() => assertMinimizedIntegrationPayload({ [field]: "sensitive" }));
  });
}
