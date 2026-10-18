# Pilot school administration

The /admin interface lets a current school administrator rename their school and create, copy and revoke email-bound invitations. Invitations are managed by PEOS and contain no school or email data in their opaque links. The link is shown once at creation; only its hash is retained. Administrators copy the link and choose how to share it. No outbound email service is invoked.

The /join screen preserves the invitation through Google OAuth and asks the recipient to accept the displayed school and role. It requires the invited email account. The SpaceCase server sends the HttpOnly Supabase session's access token to PEOS for fresh recipient verification; the token is never exposed to browser JavaScript. Success clears the invitation cookie and opens the appropriate workspace.

All administrative APIs proxy to versioned PEOS endpoints using the caller's PEOS session. Writes require the canonical same-origin request. PEOS checks school scope and current role on each action, independent of interface visibility. School administrators are redirected from /dashboard to /admin after authentication.

This slice sets up canonical school administration and staff membership. Teacher class assignment and the product database-backed teaching tools are separate setup steps. No learner data, synthetic users, class assignments, subscriptions or Atlas consent is created.

## Manual delivery module

The admin screen explicitly labels email delivery as disabled and each invitation as Email not sent. Creation exposes a one-time copyable link and a ready-to-share invitation message with school, role, Google sign-in instructions and the exact expiry. Plain-text and escaped HTML templates live in platform/invitations/message.ts; copying a message sends nothing.

Replace link is available for pending invitations. It invalidates the previous token without extending the expiry. The administrator confirms that consequence before rotating and must copy the new link. Revoked/expired invitations need a new invitation; accepted invitations cannot be replaced. No resend-email action is advertised until delivery exists.

See adr/0002-manual-invitation-delivery.md for ownership, acceptance and the future activation gate. No new database migration or environment configuration is required for manual delivery.

Open email draft is available while a newly created or replaced link is displayed. It uses a mailto link to request the user's configured email composer with a validated single recipient, encoded subject and plain-text message. The administrator must review and send the email themselves. The UI says sending is not confirmed and provides copy fallbacks when no email handler is configured. SpaceCase cannot observe draft creation, sending or delivery; the system delivery column remains Not sent. No draft is persisted, no Gmail permission is requested and no email is sent by the application.

## Accepted teachers awaiting classes

After PEOS confirms current school authority and the matching person, a teacher with zero assigned classes receives setupStatus=CLASS_ASSIGNMENT_REQUIRED. The dashboard acknowledges the account connection and explains that an administrator must assign classes. It does not open operational storage or return learner data. schoolWorkspace.configured=null means configuration has not been inspected. This is not a database health fallback: assigned teachers still require working product storage, and operational failures remain 503. An unconfirmed or mismatched identity never reaches this state.
