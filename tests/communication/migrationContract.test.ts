import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../../db/migrations/0004_stos_communication.sql", import.meta.url);

test("communication schema enforces approval and send invariants", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /status IN \('DRAFT','REVIEWED','APPROVED','SENT','CANCELLED'\)/);
  assert.match(sql, /approved_by_person_id IS NOT NULL AND approved_at IS NOT NULL/);
  assert.match(sql, /status <> 'SENT'\) OR sent_at IS NOT NULL/);
});
