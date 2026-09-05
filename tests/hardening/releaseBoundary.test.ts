import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readinessPath = new URL("../../docs/RELEASE_READINESS.md", import.meta.url);

test("release readiness separates code validation from external activation", async () => {
  const text = await readFile(readinessPath, "utf8");
  assert.match(text, /Code gate/);
  assert.match(text, /External activation gate/);
  assert.match(text, /Production deployment/);
  assert.match(text, /OIDC issuer\/audience\/JWKS/);
  assert.match(text, /fail-closed/);
});
