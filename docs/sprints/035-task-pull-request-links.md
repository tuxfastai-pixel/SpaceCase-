# Sprint 035 — Exact-commit task links

Goal: save the PR and reviewed head once for each engineering task.
Scope: append-only links, signed source/revision binding, GitHub checks outside row locks, idempotent transition retries and history events.
Out of scope: code changes, agent execution, approval and automatic updates to a changed head.
Acceptance: wrong source, changed/closed source, cancelled/expired task, changed PR/head/base and stale task revision cannot link. Concurrent identical saves create one association and event. Current unchanged links do not create duplicate records.
Security: fresh PEOS founder authority, separate signed purpose and metadata-only responses. No new credentials or access to school records.
Validation: PostgreSQL integration, transport/authority tests, typechecks/builds/lint and synthetic browser workflow.
Documentation: migration 0003 and ADR 0022.
