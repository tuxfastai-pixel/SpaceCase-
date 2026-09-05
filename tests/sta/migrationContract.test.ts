import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../../db/migrations/0005_stos_sta_foundation.sql", import.meta.url);

test("STA ledger restricts capabilities and request states", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /capability IN \('TEACHING','ASSESSMENT','PLANNING','COMMUNICATION','ADMIN','WELLBEING','ATLAS','RESEARCH','INNOVATION'\)/);
  assert.match(sql, /status IN \('RECEIVED','ROUTED','COMPLETED','DENIED','FAILED'\)/);
  assert.match(sql, /policy_version text NOT NULL/);
});
