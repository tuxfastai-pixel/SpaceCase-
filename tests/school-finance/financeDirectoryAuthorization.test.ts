import test from "node:test";
import assert from "node:assert/strict";
import { FinanceAuthorizationError, financeSchools } from "../../platform/finance/peosAuthorization";

test("finance school directory rejects missing or malformed bearer without calling PEOS", async () => {
  let calls = 0;
  const fakeFetch = (async () => {
    calls += 1;
    throw new Error("Unexpected network call");
  }) as typeof fetch;
  for (const token of ["", "Bearer null", "Bearer undefined", "Bearer ", "Basic abc", "Bearer abc def"]) {
    await assert.rejects(
      financeSchools(token, fakeFetch),
      (error: unknown) => error instanceof FinanceAuthorizationError && error.status === 401,
      `Expected rejection for ${JSON.stringify(token)}`,
    );
  }
  assert.equal(calls, 0);
});
