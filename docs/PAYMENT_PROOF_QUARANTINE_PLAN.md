# Payment proof — private receiving foundation

22 November 2026. ACT-PAY-04-QUARANTINE. Source-only implementation slice; no browser upload, public route, scanner, Finance receipt link or hosted activation.

## Goal and acceptance

Prepare the receiving boundary for the parent flow **I have paid → Choose proof → Check amount/date/reference → Submit → Track review**. Complete this foundation with strict input/file bounds, current purpose-specific authority, private quarantine, deterministic retries, current-scope status lookup, explicit retention configuration and restricted-runtime lifecycle tests. A file submission cannot change invoices, receipts, allocations, accepted activity plans or authority.

This slice deliberately has no file-release capability. A signature match means only a supported candidate for quarantine; it does not mean the document is valid, malware-free, genuine, or paid. Do not expose the receiving service directly to a parent while the following release dependencies are unfinished.

## Boundaries and failure cases

- PEOS `family-billing-v1` already names `family.finance.proof.submit`. Existing billing-read or activity-plan grants do not authorize proof submission. Resolve school/learner/person exclusively from a current decision; recheck exact scope and permission before commit or status return, including retries. No new grants or PEOS changes in this slice.
- The strict claim has positive bounded integer cents, a real payment date no later than today's Africa/Johannesburg date, a bounded reference and payment method. No parent-supplied verification, school/account/learner selector, file URL or receipt ID.
- Maximum file size is 2 MiB; only JPEG, PNG and PDF candidates with matching basic signatures are accepted into quarantine. Copy the input bytes before hashing/storage. Do not execute, parse for display, render, extract or serve a file here. Never use onboarding photo URLs or public Blob links for payment evidence.
- Private PostgreSQL binary quarantine is separated from immutable case metadata and request aliases. No filename or document contents in audit metadata. Ordinary web runtime has INSERT-only access to quarantined bytes, not SELECT/UPDATE/DELETE. It may SELECT/INSERT case metadata/request rows, not overwrite/delete history. No SECURITY DEFINER or schema creation privilege.
- Account locking serializes request identity, duplicate-file checks and quotas. The digest binds grant, claims, MIME and file hash. Same-key/same-payload replay returns the same case after current authorization; changed payload fails. Same owner/learner/school file with identical claims and a new request key receives a durable alias to the existing case; changed claims fail. Cross-parent/cross-child/cross-school records are not disclosed. Cross-owner matching is reserved for a later authorized Finance duplicate review and must not disclose another family's case to a parent.
- Explicit trusted server configuration is required: version, 1–72 quarantine hours, bounded rolling-24-hour person request limit, bounded account byte budget. No default school financial retention policy is inferred. Duplicate request aliases count toward the request quota; exact same-key recovery is allowed after quota. Metadata quota calculations do not need raw-file read permission.
- Status exposes owner-scoped claimed amount/date/reference/method, timestamps and QUARANTINED/EXPIRED only. No hashes, bytes, canonical IDs or verification claim. Expiry is enforced in the read result even before physical cleanup. An expired proof is not resurrected or represented as newly uploaded when retried.
- A separately provisioned `spacecase_proof_cleanup` role can delete expired binary rows in batches of at most 100 and append an opaque purge record atomically. Migration grants privileges only if that role already exists, and does not create a login, credentials, role membership or scheduler. Normal web runtime cannot run cleanup. Metadata/audit history remains. Active quarantined files are not deleted. A future production cleanup schedule, monitoring and backup expiry handling are release requirements; a successful test is not an operational retention guarantee.

## Schema and implementation

`20261122120000_family_payment_proof_quarantine.sql`: immutable `payment_proof_cases`, `payment_proof_requests`, separate `payment_proof_quarantine` binary rows and append-only `payment_proof_purges`. Source functions are `submitPaymentProof`, `paymentProofStatus` and `purgeExpiredPaymentProofFiles`; none is wired to an HTTP endpoint or browser UI. Tests create the dedicated non-login cleanup role only inside disposable CI, then exercise actual restricted roles.

## Next stages and release gates

1. Approved scanner adapter, hash-bound trusted verdicts, failure/timeout quarantine, clean-file private storage/delivery with fresh family/staff permission, content disposition and nosniff. Safe image normalization and safe PDF delivery policy; no self-declared CLEAN field. Define and approve clean evidence/metadata retention and backup expiry policy before collecting documents.
2. Purpose-specific Principal proof permission control, route upload limits/stream bounds, same-origin protection, current-scope checks and rate limits. Parent three-step review, persistent acknowledgement/status recovery and no automatic resubmit. Existing read/plan grants remain unchanged.
3. Finance attention queue with meaningful age/deadline/duplicate hints; independent bank verification, atomic existing receipt linking, immutable review decisions, rejection/more-information history and no duplicate imported receipt. File cleanup must not erase decision/audit history. An upload must never directly reduce balances.
4. Guarded isolated migration and worker configuration after full CI, then synthetic staff/parent/cross-scope/revocation/upload/expiry/scan/phone walkthrough. Only then consider isolated feature activation. No Production release, provider selection, paid service, message or real bank document in this build.
5. ACT-PAY-05 statements/notification outbox remain later. Existing Finance audit and ACT-PAY-03 optional enrolment/top-up intentions remain on the register.
