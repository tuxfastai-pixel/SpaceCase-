import assert from "node:assert/strict";
import test from "node:test";

import { communicationActionSchema, createParentMessageSchema } from "../../domains/communication/contracts";

const schoolId = "11111111-1111-4111-8111-111111111111";

test("parent message input is purpose bounded", () => {
  assert.equal(createParentMessageSchema.safeParse({ schoolId, purpose: "HOMEWORK", subject: "Homework", body: "Please review today's work." }).success, true);
  assert.equal(createParentMessageSchema.safeParse({ schoolId, purpose: "ATLAS_GROWTH_DNA", subject: "Profile", body: "Sensitive data" }).success, false);
});

test("communication input rejects unknown fields", () => {
  assert.equal(createParentMessageSchema.safeParse({ schoolId, purpose: "GENERAL_SCHOOL", subject: "Notice", body: "Hello", recipientEmail: "parent@example.com" }).success, false);
});

test("edit action requires changed content", () => {
  assert.equal(communicationActionSchema.safeParse({ action: "EDIT" }).success, false);
  assert.equal(communicationActionSchema.safeParse({ action: "EDIT", body: "Teacher-edited content" }).success, true);
});
