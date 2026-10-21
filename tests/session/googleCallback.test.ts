import assert from "node:assert/strict";
import test from "node:test";
import { completeSignIn } from "../../platform/auth/completeSignIn";

test("a failed PKCE exchange cannot create a PEOS session", async () => {
  const result = await completeSignIn("bad-code",
    async () => ({ data: { session: null }, error: new Error("missing verifier") }),
    async () => { throw new Error("must not reach PEOS"); });
  assert.deepEqual(result, { error: "signin" });
});

test("only the server-exchanged token is forwarded and only the PEOS cookie is returned", async () => {
  const result = await completeSignIn("auth-code", async (code) => {
    assert.equal(code, "auth-code");
    return { data: { session: { access_token: "supabase-token" } }, error: null };
  }, async token => {
    assert.equal(token, "supabase-token");
    return new Response(JSON.stringify({ accessToken: "must-not-be-exposed" }), {
      status: 201, headers: { "set-cookie": "peos_session=opaque; HttpOnly; Secure; SameSite=Lax" },
    });
  });
  assert.deepEqual(result, { cookie: "peos_session=opaque; HttpOnly; Secure; SameSite=Lax" });
  assert.ok(!JSON.stringify(result).includes("supabase-token"));
});

for (const status of [401, 403, 500, 503]) {
  test(`PEOS ${status} never becomes a successful browser session`, async () => {
    const result = await completeSignIn("code",
      async () => ({ data: { session: { access_token: "token" } }, error: null }),
      async () => new Response("private upstream error", { status }));
    assert.deepEqual(result, { error: status === 403 ? "account" : "unavailable" });
  });
}

test("a successful upstream response without a session cookie fails closed", async () => {
  const result = await completeSignIn("code",
    async () => ({ data: { session: { access_token: "token" } }, error: null }),
    async () => new Response(null, { status: 201 }));
  assert.deepEqual(result, { error: "unavailable" });
});
