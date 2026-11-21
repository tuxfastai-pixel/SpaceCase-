# Parent invitation simplification — 21 November 2026

## Immediate repair

The isolated Finance Preview had Vercel Authentication enabled for all deployments. Parents were directed to Vercel before the application. Disabled that hosting gate only on `spacecase-finance-test`; application Google sign-in, invitation-token validation, exact invited-email checks, current staff authority and independent confirmation remain enforced. No Production or companion PEOS protection was changed. An unsigned-in request to the stable parent invitation route returned HTTP 200 without a Vercel redirect.

Prepared source adds class/learner hints, a focused and bounded highlighted sending-options panel after successful creation, visible expiry/history, and pending/claimed/confirmed duplicate hints. Parent entry is Sign in → Accept → Track school review, with the private invitation held in an HttpOnly cookie across Google sign-in. No message or invitation is automatically sent, accepted or confirmed. Motion respects reduced-motion preference.

Companion PEOS change records denied duplicate creation attempts against the existing invitation without storing email/token in audit metadata, and rejects another invitation for a still-active confirmed contact. Existing pending uniqueness lock and expired-invite renewal/history remain. A parent email may legitimately have separate invitations for siblings.

## Bulk parents — planned, not enabled

Reuse the familiar staff-import pattern but keep parent connections separate from staff roles. CSV template: learner_reference,parent_email,relationship,phone_optional. A class selector can supply existing learner references; no fuzzy matching of names. Never treat an unverified imported phone as proof of parental authority.

1. Upload a maximum-size-limited CSV or select a class's authorized contact records.
2. Match each exact learner reference within the current school. Show unknown/inactive learners, invalid email, duplicate learner/email pairs, pending claims and already confirmed contacts. Same parent/different learner is valid.
3. Show new invitations, expired invitations needing renewal, and skips separately. School staff review the selected rows before creating links.
4. Create bounded batches through PEOS with current authority on each row. Persist request IDs and row outcomes; resume from status, never blindly resend after a timeout. Keep a private downloadable outcome report without bearer links by default.
5. Share each invitation privately. Never use a WhatsApp group or a shared recipient list. Manual draft opening is not delivery confirmation.

## Automation boundary

Can automate after staff review: exact matching, normalization, duplicate detection, expiry classification, individual message drafting, progress updates and incomplete-row reports. An approved outbound provider and opt-in/contact policy are prerequisites for automatic email/WhatsApp, bounded reminders, delivery receipts and retry queues. Respect accepted/confirmed/revoked/declined status; reminder delay alone must not rotate an existing valid link. Renew only expired invitations (explicitly reviewed); deliberate lost-link replacement invalidates the prior token and does not extend its expiry.

Never automate school verification or billing grants from a CSV or a claimed invitation. Invited-only first-time PEOS identity provisioning remains a separate onboarding dependency for accounts not yet provisioned; public signup remains disabled in this test environment. The configured trial parent is already provisioned. Do not claim general new-parent onboarding acceptance from that trial.

## Acceptance remaining

Full CI for both repositories, isolated deployment, desktop/phone/keyboard and reduced-motion sharing walkthrough, real Google roundtrip, and WhatsApp draft opening. An actual WhatsApp trial send needs the user's intended recipient number; no send is authorized to an unspecified contact. Bulk parent creation and automatic delivery are not implemented by this repair. Earlier Finance acceptance and activity/proof/statement work remains in FINANCE_CONTINUITY.md.

## Release evidence

Both repositories passed full CI (366 SpaceCase/service tests and 69 PEOS tests, no failures/skips). The tested sources were released only to isolated Finance aliases using their protected branch settings. Anonymous read-back verified the new parent sign-in screen with HTTP 200 and no hosting-login redirect. Connected-browser inspection failed; real Google acceptance, sending-panel visual/keyboard/mobile acceptance and WhatsApp handoff remain pending. No trial message was sent. See FIN-INVITE-UX-01 in FEATURE_COMPLETION_REGISTER.md for exact deployment and workflow evidence.
