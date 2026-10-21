import assert from "node:assert/strict";
import test from "node:test";

import { routeStaCapability } from "../../domains/sta/router";

test("STA keeps ordinary teacher capabilities inside SpaceCase", () => {
  assert.equal(routeStaCapability("PLANNING").handler, "SPACECASE");
  assert.equal(routeStaCapability("COMMUNICATION").handler, "SPACECASE");
});

test("STA routes Atlas capability only through the Atlas adapter", () => {
  const route = routeStaCapability("ATLAS");
  assert.equal(route.handler, "ATLAS_ADAPTER");
  assert.equal(route.requiresLearnerAuthority, true);
});

test("learner-sensitive capabilities require learner authority", () => {
  assert.equal(routeStaCapability("ASSESSMENT").requiresLearnerAuthority, true);
  assert.equal(routeStaCapability("WELLBEING").requiresLearnerAuthority, true);
});
