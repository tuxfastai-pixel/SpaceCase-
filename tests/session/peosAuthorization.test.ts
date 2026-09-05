import assert from "node:assert/strict";
import test from "node:test";

import { resolvePeosAuthorization } from "../../platform/session/peosAuthorization";

test("explicit bearer authorization takes precedence", () => {
  const request = new Request("https://spacecase.test", {
    headers: {
      authorization: "Bearer header-token",
      cookie: "peos_session=cookie-token",
    },
  });

  assert.equal(resolvePeosAuthorization(request), "Bearer header-token");
});

test("PEOS session cookie becomes bearer authorization", () => {
  const request = new Request("https://spacecase.test", {
    headers: { cookie: "other=value; peos_session=cookie-token" },
  });

  assert.equal(resolvePeosAuthorization(request), "Bearer cookie-token");
});

test("missing PEOS session returns null", () => {
  const request = new Request("https://spacecase.test");
  assert.equal(resolvePeosAuthorization(request), null);
});
