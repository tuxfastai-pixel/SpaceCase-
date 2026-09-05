import assert from "node:assert/strict";
import test from "node:test";

import { authorizeMessageSend } from "../../domains/communication/sendPolicy";

const teacher = "teacher-1";

test("only the authenticated approving teacher may send", () => {
  assert.equal(authorizeMessageSend({ status: "APPROVED", authenticatedPersonId: teacher, teacherPersonId: teacher, approvedByPersonId: teacher }), true);
  assert.equal(authorizeMessageSend({ status: "REVIEWED", authenticatedPersonId: teacher, teacherPersonId: teacher, approvedByPersonId: teacher }), false);
  assert.equal(authorizeMessageSend({ status: "APPROVED", authenticatedPersonId: "teacher-2", teacherPersonId: teacher, approvedByPersonId: teacher }), false);
  assert.equal(authorizeMessageSend({ status: "APPROVED", authenticatedPersonId: teacher, teacherPersonId: teacher, approvedByPersonId: "teacher-2" }), false);
});
