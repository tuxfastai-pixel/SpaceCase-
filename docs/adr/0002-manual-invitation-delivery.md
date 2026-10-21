# Manual invitation delivery with a disabled email transport

## Decision and acceptance

The pilot uses manual invitation links. Email remains explicitly disabled until a real provider and owned sender domain are configured and reviewed. The UI must never imply that creating or copying an invitation sent an email. No provider, paid resource, queue, SMTP server, credentials or automatic outbound message is created by this change.

PEOS owns invitation security, audit and the shared delivery contract. SpaceCase owns the branded subject, plain-text and HTML copy, and administration UI. The current transport returns NOT_SENT / DELIVERY_NOT_CONFIGURED without network access or storage. Future SUBMITTED means provider acceptance, not mailbox delivery. A delivery confirmation would require a verified provider event.

GET invitations returns the manual delivery policy. Each invitation's emailStatus is derived as NOT_SENT because this release has no email transport. It is not historical email telemetry and must be replaced with persisted attempt/event records before enabling delivery.

## Replacement links

Only an active school administrator can POST to the school-scoped invitation resource to replace a pending link. PEOS locks the invitation row, checks the issuer's current authority, rotates only the token hash and audits the action. The original expiry, recipient, role and issuer are preserved. Old links immediately fail subsequent preview/acceptance. Accepted, revoked or expired invitations cannot be revived. Concurrent acceptance, replacement and revocation serialize on the same invitation row. Tokens cannot be retrieved after creation; no plaintext token is persisted.

## Activation gate

Before adding a live transport: verify the sender domain; provision the chosen provider; configure secrets server-side; persist delivery attempts and signed webhook events; add per-school/recipient rate limits, idempotency, retry/backoff and bounded retention; recheck current invitation validity before dispatch; decide how queued secrets are encrypted and destroyed. Keep invitation acceptance explicit so mail scanners cannot grant roles. Test provider failures, duplicate events, revocation before dispatch and accurate UI states before release.

An environment flag or API key alone cannot activate this implementation. Existing pending invitations are not automatically emailed when a future transport is installed. Administrator-initiated send actions require explicit implementation and tests.

## Verification

Unit tests cover disabled transport behavior, safe template escaping, opaque fragment URLs and malformed input. PostgreSQL CI covers scoped replacement, old-token invalidation, unchanged expiry, wrong recipients, terminal invitation states and audit privacy. Existing sign-in, acceptance and revocation tests continue to run.

## Email composer handoff

During the pilot, Open email draft uses mailto to hand the one-time invitation to the administrator's configured email client. It encodes the recipient, subject and body independently so the invitation's fragment survives inside the message and input cannot inject extra recipients/headers. This is manual sharing, not a delivery transport. Opening a draft is neither observable nor acknowledged by SpaceCase, and never changes delivery metadata. The screen retains copy fallbacks and asks the administrator to review and press Send. Links and draft contents remain only in the current page's memory. Test decoding, special characters, exact recipient binding and header-injection rejection before release.
