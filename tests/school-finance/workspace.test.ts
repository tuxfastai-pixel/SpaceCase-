import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  financeCommand,
  financeDate,
  randToMinor,
  formatZar,
} from "../../domains/school-finance/workspaceContracts";
import {
  financeWorkspaceGet,
  financeWorkspacePost,
} from "../../platform/finance/workspaceHttp";
import { FinanceAuthorizationError, financeSchools } from "../../platform/finance/peosAuthorization";
import { splitInstalmentsForForm } from "../../app/finance/forms";
const schoolId = randomUUID(),
  accountId = randomUUID(),
  endpoint = "https://spacecase.example/api/finance/workspace";
const payment = {
  command: "PAYMENT",
  schoolId,
  accountId,
  reference: "REF-1",
  amountMinor: "100",
  method: "EFT",
};
test("finance money entry and dates reject rounding, overflow and impossible calendar dates", () => {
  assert.equal(randToMinor("123.4"), "12340");
  assert.equal(randToMinor("92233720368547758.07"), "9223372036854775807");
  for (const value of ["1.001", "1e3", "-1", "01.50", "92233720368547758.08"])
    assert.throws(() => randToMinor(value));
  assert.equal(
    formatZar("9007199254740993").replaceAll(/[^0-9.]/g, ""),
    "90071992547409.93",
  );
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01"])
    assert.equal(financeDate.safeParse(date).success, false);
  assert.deepEqual(
    splitInstalmentsForForm("100", "2026-11-30\n2026-12-31\n2027-01-31").map(
      (v) => v.amountMinor,
    ),
    ["34", "33", "33"],
  );
  assert.throws(() => splitInstalmentsForForm("100", "2027-01-31\n2026-12-31"));
});
test("financial commands cannot assert actor, verification or a precomputed balance", () => {
  for (const extra of [
    { actorPersonId: randomUUID() },
    { verification: "VERIFIED" },
    { availableMinor: "100" },
  ])
    assert.equal(
      financeCommand.safeParse({ ...payment, ...extra }).success,
      false,
    );
  assert.equal(
    financeCommand.safeParse({ ...payment, amountMinor: "0" }).success,
    false,
  );
  assert.equal(
    financeCommand.safeParse({ ...payment, amountMinor: "1.50" }).success,
    false,
  );
});
test("workspace gate, CSRF, bounded input and current authority deny before database access", async () => {
  const old = process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED;
  const deps = {
    pool: () => {
      throw Error("Database must not be reached");
    },
    permission: async () => {
      throw new FinanceAuthorizationError(403, "FINANCE_FORBIDDEN");
    },
    learner: async () => {
      throw Error("Unused");
    },
  };
  const request = (body: unknown, origin = "https://spacecase.example") =>
    new Request(endpoint, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    delete process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED;
    assert.equal(
      (await financeWorkspacePost(request(payment), deps)).status,
      503,
    );
    process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED = "true";
    assert.equal(
      (
        await financeWorkspacePost(
          request(payment, "https://attacker.example"),
          deps,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await financeWorkspacePost(
          request({ ...payment, actorPersonId: randomUUID() }),
          deps,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await financeWorkspacePost(
          request({ ...payment, reference: "x".repeat(65000) }),
          deps,
        )
      ).status,
      413,
    );
    assert.equal(
      (await financeWorkspacePost(request(payment), deps)).status,
      403,
    );
    const response = await financeWorkspaceGet(
      new Request(endpoint + "?schoolId=" + schoolId),
      deps,
    );
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    if (old === undefined)
      delete process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED;
    else process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED = old;
  }
});

test("school UUID normalization prevents duplicate text-scoped finance accounts", () => {
  const uppercase = "ABCDEFAB-1234-4ABC-8ABC-ABCDEFABCDEF";
  const parsed = financeCommand.parse({
    command: "INITIALIZE",
    schoolId: uppercase,
  });
  assert.equal(parsed.schoolId, uppercase.toLowerCase());
});


test("finance remains disabled in authority-only mode even with the finance flag set", async () => {
  const previousFlag = process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED;
  const previousMode = process.env.SPACECASE_WORKSPACE_MODE;
  const deps = {
    pool: () => { throw Error("Disabled finance must not access database"); },
    permission: async () => { throw Error("Disabled finance must not query authority"); },
    learner: async () => { throw Error("Disabled finance must not query learners"); },
  };
  try {
    process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED = "true";
    process.env.SPACECASE_WORKSPACE_MODE = "authority_only";
    const get = await financeWorkspaceGet(new Request(endpoint + "?schoolId=" + schoolId), deps);
    const post = await financeWorkspacePost(new Request(endpoint, {
      method: "POST",
      headers: { origin: "https://spacecase.example", "content-type": "application/json" },
      body: JSON.stringify({ command: "INITIALIZE", schoolId }),
    }), deps);
    assert.equal(get.status, 503);
    assert.equal(post.status, 503);
    assert.equal((await get.json()).error, "FINANCE_NOT_ENABLED");
    assert.equal((await post.json()).error, "FINANCE_NOT_ENABLED");
    assert.equal(get.headers.get("cache-control"), "no-store");
    assert.equal(post.headers.get("cache-control"), "no-store");
  } finally {
    if (previousFlag === undefined) delete process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED;
    else process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED = previousFlag;
    if (previousMode === undefined) delete process.env.SPACECASE_WORKSPACE_MODE;
    else process.env.SPACECASE_WORKSPACE_MODE = previousMode;
  }
});

test("PEOS finance directory fails closed on denial, outage and malformed authority data", async () => {
  const previous = process.env.PEOS_BASE_URL;
  process.env.PEOS_BASE_URL = "https://peos.example";
  const respond = (status: number, body: unknown) =>
    (async () => Response.json(body, { status })) as typeof fetch;
  try {
    for (const [status, expected] of [[401, 401], [403, 403], [500, 503]] as const) {
      await assert.rejects(
        financeSchools("Bearer synthetic", respond(status, { error: "denied" })),
        (error: unknown) => error instanceof FinanceAuthorizationError && error.status === expected,
      );
    }
    await assert.rejects(
      financeSchools("Bearer synthetic", (async () => { throw new Error("network down"); }) as typeof fetch),
      (error: unknown) => error instanceof FinanceAuthorizationError && error.status === 503,
    );
    await assert.rejects(
      financeSchools("Bearer synthetic", respond(200, { schools: [{ id: schoolId, displayName: "School", actions: ["finance.unknown"] }], truncated: false })),
      (error: unknown) => error instanceof FinanceAuthorizationError && error.message === "PEOS_INVALID_AUTHORITY_RESPONSE",
    );
    const valid = await financeSchools("Bearer synthetic", respond(200, { schools: [{ id: schoolId, displayName: "School", actions: ["finance.transactions.read"] }], truncated: false }));
    assert.equal(valid.schools[0].id, schoolId);
  } finally {
    if (previous === undefined) delete process.env.PEOS_BASE_URL;
    else process.env.PEOS_BASE_URL = previous;
  }
});
