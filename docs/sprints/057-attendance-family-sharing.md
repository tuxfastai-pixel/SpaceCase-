# Sprint 057 — bulk attendance and clearer family invitations

## Goal and scope
Reduce daily register work and school-family invitation steps. Add selected-group attendance, direct admin/principal parent entry, class/learner selection, existing invitation progress, copy/browser-email/default-email/WhatsApp composers, and secure recovery of a lost issued link through token rotation.

## Acceptance and boundaries
- Teacher selects one/many/all roster learners, marks the selected group present in a draft, reviews and explicitly saves through the existing audited revision/assignment checks. Overwriting absent/late/excused marks requires confirmation. Selection resets after register reload/date load.
- Parent invitation entry is prominent in school administration and principal operations. Existing learner registration stays the authority; the UI links directly to the selected class when a learner needs registering. Private parent draft submission is still disabled (FAM-01).
- Show existing invitations for the chosen learner, not a new invitation form alone. A new link stays only in component memory; no browser storage. Reopening an issued invitation offers an explicit replacement (old token invalid, same expiry). Claimed/confirmed/revoked/expired invitations cannot rotate. Learner filtering never replaces current school authorization.
- Generic family invitation includes no learner name, medical/photo/draft data. Email and WhatsApp carry the same link and require the exact invited email to accept. Both are explicit external draft links, never sends or delivery receipts.
- Browser Gmail is the first email composer; default email app and copy remain available. A website cannot reliably discover installed Chrome or override the device browser. Users may run SpaceCase in Chrome or set Chrome as default. No custom-protocol launch/probing.
- Green/check = canonical CLAIMED, awaiting independent school review. Blue/check = canonical CONFIRMED school contact. No timer confers confirmation/guardianship or learner-record access. Revoked/expired/withdrawn states are textual neutral states.
- Refresh visible invitation status every 30 seconds and on window focus. Stop in background; review queue polling pauses while a review checkbox is selected. User can refresh explicitly. No per-row roster fetch fan-out; only the opened learner panel fetches its invitation history. Class directory max 200 and learner/history pages max 100, with explicit pagination/history caveat.

## Failure analysis and security
A copied link cannot be recovered from its hash. Avoid plaintext storage: lock the invitation and rotate a 32-byte opaque token, retain creator/expiry and verify current admin/issuer/learner authority. Claim, review, withdrawal and rotation share the invitation row lock, so a claimed token cannot be replaced. No schema, provider secret, role grant, sender activation or production identity changes. SpaceCase origin checks and PEOS authenticated/current authority remain independent of UI. Audit rotation without token/email metadata. External composer links use no referrer/opener. Status-only styling includes text, not colour alone.

## Verification / release
Local typecheck/lint both repos passed. SpaceCase generic share/status unit tests; PEOS integration tests cover changed token, unchanged expiry, old-link denial, wrong-school/admin denial, claimed/confirmed/expired/ended-issuer rotation denial, filtered listing and unchanged no-role guarantees. Full PostgreSQL CI, browser fixture walkthrough and deployment evidence pending at preparation. Actual account acceptance/review and physical phone sharing need live pilot evidence; opening a draft cannot prove sending.

## Out of scope
Automatic email or WhatsApp sending/provider activation, child creation from unreviewed parent input, submission of private family drafts, legal guardianship, record access contracts and timer-based approval. Track MSG-01, FAM-01/02, QA-01/06, SHARE-01 and ATT-01.
