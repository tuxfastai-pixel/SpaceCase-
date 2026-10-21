import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checklistPath = new URL("../../docs/SECURITY_RELEASE_CHECKLIST.md", import.meta.url);

test("security checklist preserves critical production gates", async () => {
  const text = await readFile(checklistPath, "utf8");
  for (const phrase of ["PEOS remains canonical", "Communication cannot send", "Atlas onboarding requires", "Atlas bridge requires", "Production smoke test"]) {
    assert.equal(text.includes(phrase), true);
  }
});
