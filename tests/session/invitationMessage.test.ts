import assert from "node:assert/strict";
import test from "node:test";
import { invitationEmailDraft, prepareInvitationMessage } from "../../platform/invitations/message";

const input = { origin: "https://spacecase.example.test", token: "a".repeat(43), schoolName: "Pilot School",
  roleCode: "TEACHER", expiresAt: "2026-10-25T18:00:00.000Z" };
test("manual invitation explains recipient verification, role, expiry and replacement", () => {
  const message = prepareInvitationMessage(input);
  const url = new URL(message.link);
  assert.equal(url.pathname, "/join");
  assert.equal(url.search, "");
  assert.equal(url.hash, `#token=${input.token}`);
  assert.match(message.text, /as a teacher/);
  assert.match(message.text, /email address this invitation was sent to/);
  assert.match(message.text, /2026-10-25 18:00:00 UTC/);
  assert.match(message.text, /replacement link invalidates the previous link/);
  assert.match(prepareInvitationMessage({ ...input, roleCode: "SCHOOL_ADMINISTRATOR" }).text, /as a school administrator/);
});
test("untrusted school names cannot inject email HTML or subject headers", () => {
  const message = prepareInvitationMessage({ ...input, schoolName: '<img src=x onerror=alert(1)>\r\nBcc: injected' });
  assert.ok(!message.html.includes("<img"));
  assert.ok(message.html.includes("&lt;img"));
  assert.ok(!/[\r\n]/.test(message.subject));
});
test("invitation templates reject unsafe origins, tokens, roles and invalid expiry", () => {
  for (const origin of ["http://spacecase.example.test", "https://user:pass@example.test", "https://example.test/path", "https://example.test?token=secret"]) {
    assert.throws(() => prepareInvitationMessage({ ...input, origin }));
  }
  assert.throws(() => prepareInvitationMessage({ ...input, token: '" onclick="alert(1)' }));
  assert.throws(() => prepareInvitationMessage({ ...input, roleCode: "SUPERUSER" }));
  assert.throws(() => prepareInvitationMessage({ ...input, expiresAt: "invalid" }));
});

test("email drafts preserve the invitation fragment and encode email fields without adding recipients", () => {
  const message = prepareInvitationMessage({ ...input, schoolName: "Pilot & Progress #1?" });
  const draft = new URL(invitationEmailDraft(" Teacher+Pilot@Example.test ", message));
  assert.equal(draft.protocol, "mailto:");
  assert.equal(decodeURIComponent(draft.pathname), "teacher+pilot@example.test");
  assert.equal(draft.searchParams.get("subject"), message.subject);
  assert.equal(draft.searchParams.get("body"), message.text.replace(/\n/g, "\r\n"));
  assert.deepEqual([...draft.searchParams.keys()], ["subject", "body"]);
  assert.equal(draft.hash, "");
  assert.ok(draft.searchParams.get("body")?.includes(message.link));
  assert.ok(draft.search.includes("%20"));
  assert.ok(draft.search.includes("%0D%0A"));
});

test("email drafts reject recipient and subject header injection", () => {
  const message = prepareInvitationMessage(input);
  for (const recipient of ["teacher@example.test?bcc=other@example.test", "teacher@example.test\r\nBcc: other@example.test", "a@example.test,b@example.test"]) {
    assert.throws(() => invitationEmailDraft(recipient, message));
  }
  assert.throws(() => invitationEmailDraft("teacher@example.test", { ...message, subject: "Invite\r\nBcc: other@example.test" }));
});
