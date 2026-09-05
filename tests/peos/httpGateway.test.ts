import assert from "node:assert/strict";
import test from "node:test";

import { HttpPeosGateway } from "../../platform/peos/httpGateway";

test("loads teacher context with caller authorization", async () => {
  let requestedUrl = "";
  let authorization = "";

  const gateway = new HttpPeosGateway(
    "https://peos.example.test",
    "Bearer signed-token",
    async (input, init) => {
      requestedUrl = input.toString();
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json({
        personId: "teacher-1",
        schoolId: "school-1",
        roleIds: ["teacher"],
        classIds: ["class-1"],
        active: true,
      });
    },
  );

  const context = await gateway.getTeacherContext("teacher-1");

  assert.equal(
    requestedUrl,
    "https://peos.example.test/v1/people/teacher-1/teacher-context",
  );
  assert.equal(authorization, "Bearer signed-token");
  assert.equal(context?.schoolId, "school-1");
});

test("returns null when PEOS has no teacher context", async () => {
  const gateway = new HttpPeosGateway(
    "https://peos.example.test",
    "Bearer signed-token",
    async () => new Response(null, { status: 404 }),
  );

  assert.equal(await gateway.getTeacherContext("teacher-1"), null);
});

test("posts a purpose-limited consent check", async () => {
  let postedBody = "";
  const gateway = new HttpPeosGateway(
    "https://peos.example.test",
    "Bearer signed-token",
    async (_input, init) => {
      postedBody = String(init?.body ?? "");
      return Response.json({
        granted: true,
        consentGrantId: "grant-1",
        policyVersion: "consent-v1",
      });
    },
  );

  const result = await gateway.checkConsent({
    parentPersonId: "parent-1",
    learnerPersonId: "learner-1",
    purpose: "ATLAS_SCHOOL_SUPPORT",
    sourceProduct: "SPACECASE",
    destinationProduct: "ATLAS",
  });

  assert.equal(result.granted, true);
  assert.equal(JSON.parse(postedBody).purpose, "ATLAS_SCHOOL_SUPPORT");
});
