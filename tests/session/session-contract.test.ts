import assert from "node:assert/strict";
import test from "node:test";

import { UnavailableSessionResolver } from "../../platform/session/contracts";

test("unavailable session resolver fails closed", async () => {
  const resolver = new UnavailableSessionResolver();
  const request = new Request("https://spacecase.test/api/v1/teacher/context");

  const session = await resolver.resolve(request);

  assert.equal(session, null);
});
