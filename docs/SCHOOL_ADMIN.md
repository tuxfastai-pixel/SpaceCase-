# Pilot school administration

The /admin interface lets a current school administrator rename their school and create, copy and revoke email-bound invitations. Invitations are managed by PEOS and contain no school or email data in their opaque links. The link is shown once at creation; only its hash is retained. Administrators copy the link and choose how to share it. No outbound email service is invoked.

The /join screen preserves the invitation through Google OAuth and asks the recipient to accept the displayed school and role. It requires the invited email account. The SpaceCase server sends the HttpOnly Supabase session's access token to PEOS for fresh recipient verification; the token is never exposed to browser JavaScript. Success clears the invitation cookie and opens the appropriate workspace.

All administrative APIs proxy to versioned PEOS endpoints using the caller's PEOS session. Writes require the canonical same-origin request. PEOS checks school scope and current role on each action, independent of interface visibility. School administrators are redirected from /dashboard to /admin after authentication.

This slice sets up canonical school administration and staff membership. Teacher class assignment and the product database-backed teaching tools are separate setup steps. No learner data, synthetic users, class assignments, subscriptions or Atlas consent is created.
