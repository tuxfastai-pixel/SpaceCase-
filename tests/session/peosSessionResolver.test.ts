import assert from "node:assert/strict";
import test from "node:test";

import { PeosSessionResolver } from "../../platform/session/peosSessionResolver";

test("returns null without a bearer token", async () => {
  const resolver = new PeosSessionResolver("https://peos.example.test", async () => {
    throw new Error("fetch should not be called");
  });

  const session = await resolver.resolve(new Request("https://spacecase.test/api"));
  assert.equal(session, null);
});

test("forwards bearer token to PEOS and returns validated session", async () => {
  let seenAuthorization = "";
  const resolver = new PeosSessionResolver(
    "https://peos.example.test",
    async (_input, init) => {
      seenAuthorization = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json({
        session: {
          sessionId: "session-1",
          personId: "teacher-1",
          issuedAt: "2026-09-05T10:00:00.000Z",
          expiresAt: "2026-09-05T18:00:00.000Z",
        },
      });
    },
  );

  const session = await resolver.resolve(
    new Request("https://spacecase.test/api", {
      headers: { authorization: "Bearer signed-token" },
    }),
  );

  assert.equal(seenAuthorization, "Bearer signed-token");
  assert.equal(session?.personId, "teacher-1");
});

test("fails closed when PEOS rejects the token", async () => {
  const resolver = new PeosSessionResolver(
    "https://peos.example.test",
    async () => new Response(null, { status: 401 }),
  );

  const session = await resolver.resolve(
    new Request("https://spacecase.test/api", {
      headers: { authorization: "Bearer invalid" },
    }),
  );

  assert.equal(session, null);
});
