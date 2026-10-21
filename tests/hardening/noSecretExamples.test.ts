import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const releasePath = new URL("../../docs/RELEASE_READINESS.md", import.meta.url);

test("release documentation requires external secret configuration instead of embedded credentials", async () => {
  const text = await readFile(releasePath, "utf8");
  assert.match(text, /production secrets remain explicit-permission actions|Production.*secrets/i);
  assert.equal(/BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/.test(text), false);
});
