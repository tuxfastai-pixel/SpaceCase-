import assert from "node:assert/strict";
import test from "node:test";

import { requiresTeacherApproval, transitionParentMessage } from "../../domains/communication/workflow";

test("communication requires review and teacher approval before send", () => {
  assert.equal(transitionParentMessage("DRAFT", "REVIEW"), "REVIEWED");
  assert.equal(transitionParentMessage("REVIEWED", "APPROVE"), "APPROVED");
  assert.equal(transitionParentMessage("APPROVED", "SEND"), "SENT");
});

test("draft cannot be sent directly", () => {
  assert.throws(() => transitionParentMessage("DRAFT", "SEND"));
  assert.equal(requiresTeacherApproval("DRAFT"), true);
});

test("editing reviewed content returns it to draft for renewed review", () => {
  assert.equal(transitionParentMessage("REVIEWED", "EDIT"), "DRAFT");
});

test("sent and cancelled messages are terminal", () => {
  assert.throws(() => transitionParentMessage("SENT", "EDIT"));
  assert.throws(() => transitionParentMessage("CANCELLED", "APPROVE"));
});
