import assert from "node:assert/strict";
import test from "node:test";

import { readServerEnvironment } from "../../platform/config/env";

test("environment parser accepts the empty Sprint 001 optional integration baseline", () => {
  const env = readServerEnvironment({ NODE_ENV: "test" });

  assert.equal(env.NODE_ENV, "test");
  assert.equal(env.DATABASE_URL, undefined);
});

test("environment parser rejects invalid integration URLs", () => {
  assert.throws(() =>
    readServerEnvironment({
      NODE_ENV: "test",
      PEOS_BASE_URL: "not-a-url",
    }),
  );
});
