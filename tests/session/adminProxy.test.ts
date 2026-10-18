import assert from "node:assert/strict";
import test from "node:test";
import { peosProxy } from "../../platform/admin/peosProxy";

test("admin proxy rejects cross-origin writes and forwards only the current PEOS authority", async () => {
  const oldUrl = process.env.PEOS_BASE_URL;
  const oldOrigin = process.env.SPACECASE_PUBLIC_URL;
  const oldFetch = globalThis.fetch;
  process.env.PEOS_BASE_URL = "https://peos.example.test";
  process.env.SPACECASE_PUBLIC_URL = "https://spacecase.example.test";
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(new URL(String(url)).origin, "https://peos.example.test");
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer current-session");
    assert.equal(options?.cache, "no-store");
    return Response.json({ error: "SCHOOL_ADMIN_REQUIRED" }, { status: 403 });
  };
  try {
    const blocked = await peosProxy(new Request("https://spacecase.example.test/api", {
      method: "POST", headers: { origin: "https://untrusted.example.test", cookie: "peos_session=current-session" },
    }), "/v1/admin/schools/school/invitations", { email: "person@example.test", roleCode: "TEACHER" });
    assert.equal(blocked.status, 403);
    assert.equal(calls, 0);
    assert.equal((await peosProxy(new Request("https://spacecase.example.test/api"), "/v1/admin/schools")).status, 401);
    assert.equal(calls, 0);
    const denied = await peosProxy(new Request("https://spacecase.example.test/api", { headers: { cookie: "peos_session=current-session" } }), "/v1/admin/schools");
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: "SCHOOL_ADMIN_REQUIRED" });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.PEOS_BASE_URL; else process.env.PEOS_BASE_URL = oldUrl;
    if (oldOrigin === undefined) delete process.env.SPACECASE_PUBLIC_URL; else process.env.SPACECASE_PUBLIC_URL = oldOrigin;
  }
});
