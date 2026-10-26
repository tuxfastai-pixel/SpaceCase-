import { z } from "zod";

export type InvitationMessage = { subject: string; text: string; html: string; link: string };

/** Opens the user's configured email composer; it never sends or confirms delivery. */
export function invitationEmailDraft(recipient: string, message: Pick<InvitationMessage, "subject" | "text">): string {
  const email = z.string().trim().email().max(254).parse(recipient).toLowerCase();
  if (/[\r\n\u0000-\u001f\u007f]/.test(message.subject)) throw new Error("Invalid email subject");
  const address = encodeURIComponent(email).replace(/%40/g, "@");
  const body = message.text.replace(/\r\n|\r|\n/g, "\r\n");
  return `mailto:${address}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(body)}`;
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Product-owned copy, shared by manual messages and a future server email adapter. */
export function prepareInvitationMessage(input: {
  origin: string; token: string; schoolName: string; roleCode: string; expiresAt: string;
}): InvitationMessage {
  const origin = new URL(input.origin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("A secure application origin is required");
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new Error("Invalid invitation token");
  if (!["TEACHER", "SCHOOL_ADMINISTRATOR"].includes(input.roleCode)) throw new Error("Invalid invitation role");
  if (!Number.isFinite(Date.parse(input.expiresAt))) throw new Error("Invalid invitation expiry");
  const schoolName = input.schoolName.replace(/[\r\n\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
  if (!schoolName) throw new Error("School name is required");
  const role = input.roleCode === "TEACHER" ? "teacher" : "school administrator";
  const link = `${origin.origin}/join#token=${input.token}`;
  const expires = `${new Date(input.expiresAt).toISOString().slice(0, 19).replace("T", " ")} UTC`;
  const subject = `Join ${schoolName} on SpaceCase`;
  const text = `You’re invited to join ${schoolName} on SpaceCase as a ${role}.\n\nOpen your invitation:\n${link}\n\nContinue with Google using the email address this invitation was sent to, then select Accept invitation.\n\nThis link expires on ${expires} and can be used once. A replacement link invalidates the previous link. If you weren’t expecting this invitation, you can ignore it.\n\nSpaceCase`;
  const html = `<div style="font-family:Arial,sans-serif;color:#172b22;line-height:1.6;max-width:560px;margin:auto"><p><strong>SpaceCase</strong></p><h1>${escapeHtml(subject)}</h1><p>You’re invited as a ${role}.</p><p><a href="${escapeHtml(link)}">Join ${escapeHtml(schoolName)}</a></p><p>Continue with Google using the email address this invitation was sent to, then select Accept invitation.</p><p>This link expires on ${escapeHtml(expires)} and can be used once. A replacement link invalidates the previous link.</p><p>If you weren’t expecting this invitation, you can ignore it.</p></div>`;
  return { subject, text, html, link };
}

/** Explicit user-initiated webmail composer in the current/default browser. */
export function invitationWebEmailDraft(recipient: string, message: Pick<InvitationMessage, "subject" | "text">): string {
  invitationEmailDraft(recipient,message); // validate recipient and header before constructing either composer
  return `https://mail.google.com/mail/?${new URLSearchParams({view:"cm",fs:"1",to:recipient.trim().toLowerCase(),su:message.subject,body:message.text})}`;
}
export function invitationWhatsAppDraft(message: Pick<InvitationMessage,"text">): string {
  return `https://wa.me/?${new URLSearchParams({text:message.text})}`;
}
export function prepareFamilyInvitationMessage(input: {origin:string;token:string;expiresAt:string}): InvitationMessage {
  // Reuse the strict origin, token and expiry validation; family wording has no learner PII.
  const validated=prepareInvitationMessage({...input,schoolName:"your school",roleCode:"TEACHER"});
  const link=validated.link.replace("/join#", "/family/invitation#");
  const subject="Your SpaceCase parent / caregiver invitation";
  const text=`Your school invites you to connect as a parent / caregiver on SpaceCase.\n\nOpen your private invitation:\n${link}\n\nContinue with Google using the exact email address you gave the school, then accept the invitation. You may use this same link from email or WhatsApp.\n\nThe school must review your acceptance before confirming you as a school contact. Accepting does not yet open learner records.\n\nExpires: ${new Date(input.expiresAt).toISOString()}. Share only with the intended adult. If this invitation is unexpected, ignore it.\n\nSpaceCase`;
  return {subject,text,link,html:escapeHtml(text)};
}
