# Google sign-in integration

## Decision and scope

Supabase performs Google OAuth with PKCE. SpaceCase exchanges the resulting Supabase access token with PEOS on the server. The existing HttpOnly PEOS session cookie remains the authority used by product APIs. Authentication never grants school authority.

Acceptance: login page -> Google -> Supabase callback -> PEOS session -> dashboard; active returning sessions bypass login; users without school authority see a welcome state; logout revokes the PEOS session and clears the local Supabase session. Provider errors do not expose tokens. No credentials or school roles are collected in onboarding.

## Configuration

SpaceCase requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SPACECASE_PUBLIC_URL` (canonical HTTPS origin), and `PEOS_BASE_URL`. Google client secrets belong only in Supabase's provider configuration. Add `<SPACECASE_PUBLIC_URL>/auth/callback` to Supabase's redirect allowlist. Google redirects to the Supabase project's `/auth/v1/callback`, not directly to SpaceCase.

PEOS requires the matching Supabase Auth issuer, `authenticated` audience and the issuer's published JWKS URL. Asymmetric signing keys must be available. Enable `PEOS_ALLOW_SELF_SIGNUP=true` only for the trusted Supabase issuer. New identities get no school membership, teacher role, entitlement or consent. Existing inactive or locked identities remain denied. Identity keys are provider plus subject; email never links accounts.

## Release checks

Run typecheck, lint, tests, build and repository CI. Test a real Google account in a browser: successful first sign-in, returning sign-in, cancelled Google flow, replayed callback, missing PKCE cookie, sign-out and revoked-session rejection. Confirm no school records appear without school assignment.

## Limits

School invitations and administrator assignment remain separate from this sign-in slice. No automated role assignment, profile editing, child-data consent or Atlas activation is included. Supabase refresh tokens are HttpOnly; PEOS sessions have an independent expiry. A fresh Google authentication is needed after that session ends. Do not describe this as persistent cross-product single sign-on until tested.
