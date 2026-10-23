# Sprint 037 — Audited non-approval decisions

Goal: let a founder record request-changes, defer and decline against an exact review snapshot.
Scope: explicit confirmation, immutable decision records, stale-review rejection, actor/request UUID idempotency, bounded history and same-request retry UI.
Out of scope: enabling approval before verified evidence, release execution, changing ticket status or cancelling a task implicitly.
Acceptance: duplicate retries create one record/event; changed requests, current evidence or task revisions cannot reuse a stale decision. An unverified approval is refused before pooling and by a database CHECK constraint. Decisions and links remain visible after cancellation or brief removal.
Security: fresh PEOS founder authorization, signed purpose, restricted append-only grants, immutable audit events and no saved brief content returned.
Validation: concurrent PostgreSQL integration, runtime-grant denials, API and acknowledgement-binding tests, synthetic confirmation/retry browser checks and full CI.
Documentation: ADR 0022 and migration 0003.
