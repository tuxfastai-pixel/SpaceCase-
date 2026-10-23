# Sprint 039 — Durable founder evidence collection

Goal: let the founder record and revisit reproduction, acceptance and rollback evidence with truthful verification status.

Scope: append-only engineering storage, task/source/link binding, idempotent save/list controls, audit projection, seven-day detail retention, founder form and same-request retry.

Out of scope: arbitrary file uploads, learner data, live proof verification, GitHub credentials, approval activation, autonomous agents, paid inference or release execution.

Acceptance: one record for concurrent identical retries; changed UUID payload denied; stale/closed/cancelled/expired/unlinked work cannot create evidence; wrong-source reads denied; resulting task revision bound in packet; only latest five records returned; expired JSON hidden and later cleared; audit and idempotency retained. Every result is UNVERIFIED and grants no release/execution.

Security: fresh PEOS founder authorization, same-origin product boundary, signed purpose and server-derived source authority, strict bounded contracts, row locks, restricted runtime SELECT/INSERT and bounded expiry function. No new credentials or expanded school-data access.

Tests: transport/acknowledgement binding, authority injection, real PostgreSQL concurrency, grants, digest consistency, lifecycle and source rejection, retention/read-after-expiry, history. Both typechecks/lint/builds and responsive synthetic browser confirmation/retry verification.

Docs: ADR 0024; evidence foundation ADR 0023 remains relevant to the unconnected trusted verifier.
