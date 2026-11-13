# Finance automation — Engineering Pack

## Architecture and boundaries
Extend the existing modular monolith. SpaceCase owns normalized transaction intake and product financial records; PEOS owns people, schools and authority. All future connector adapters emit the same normalized incoming-transaction contract. Keep raw ingest/normalization separate from payment reporting, verification and allocation. No new payment gateway, mail provider, bank access or AI dependency is provisioned in stage 1.

## Stage 1 data and API
Add account-scoped import profiles, immutable import batches/rows and mutable queue review state with append-only audit events. Store source label, selected column mapping, delimiter, stable file digest, date, bank/payment reference, optional source transaction ID and positive integer cents. Do not persist original filenames, raw CSV, unused columns, email bodies or learner names.

CSV support: UTF-8, comma/semicolon/tab, quoted fields/escaped quotes, ISO year-first dates, explicit dot/comma decimal convention, signed amount column with debits/zero excluded and counted. Bound file bytes, rows, field/header lengths and batch size. Reject invalid positive rows before saving the batch; show line-specific errors. Saved mapping is scoped to finance account/source and header signature; verify mapped headers before reuse. No guessing locale or currency; first currency is ZAR.

POST preview recomputes all parsed values and current account-local duplicate/match facts server-side; commit must match the preview digest. Concurrent/repeated commits serialize under the existing active finance-account lock. Re-uploading the same canonical source rows is idempotent; overlapping source IDs or date/reference/amount fingerprints enter duplicate review, never disappear silently. Duplicate candidates cannot report until explicitly marked distinct with a reason or dismissed. A dismissed exact source transaction remains a replay indicator.

Suggestions use exact invoice references within the same account and show amount compatibility. Never match on amount alone, authorize from a suggestion, auto-allocate or auto-verify. A payment successfully reported from a candidate is immutable, has a unique import-derived internal reference, preserves original source fields on the candidate and requires independent verification through existing Finance. Record candidate conversion and reported-payment audit atomically; repeated clicks return the existing payment. Declined/void invoices are not candidates for a suggestion.

Routes: `/api/finance/intake` GET paginated queue + profiles; POST discriminated PREVIEW, IMPORT, REPORT, DISMISS, CONFIRM_DISTINCT. Origin check, body bounds, strict input schemas, current PEOS permission, active account/school scope and no-store responses. Feature disabled by default with `SPACECASE_FINANCE_INTAKE_ENABLED`; existing Finance enable/mode gates also apply. No production or authority-only pilot activation.

## Connector contract and future controls
Source identity, school/account scope, provider transaction identity, event version, received timestamp, transaction/settlement status and normalization version. Verify webhook signatures, persist durable inbox before acknowledgment, deduplicate provider events, handle delayed/out-of-order/retried/reversed events, reconcile fees and net deposits, retry with backoff and show last success/failure. Encrypt server-only credentials, minimize scopes and support disconnect/revocation. Never use app email labels as an OAuth permission boundary. Payment emails are candidate evidence only.

## UX acceptance
Incoming payments has preview, received/ignored/duplicate counts, saved mappings, exact-match explanations and per-item actions. Retain inputs after failed requests, cancel stale fetches on school change, bound results with paging, disable duplicate submissions, use honest empty/error states and accessible labels. No credentials or implementation instructions in ordinary school-user workflows.

## Later stages
Statement/reminder preparation respects disputes, payment arrangements, verified balances and authorized delivery configuration. Expense extraction is a draft with evidence provenance, duplicate checks and independent review. Accounting sync has an outbox, approved-only export, external IDs, retry state and conflict handling; never two uncontrolled masters. Revision history UI must make rejected earlier revisions discoverable without replacing the audit trail.
