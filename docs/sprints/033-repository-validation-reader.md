# Sprint 033 — Read-only repository validation reader

Goal: fetch authoritative public GitHub workflow metadata before connecting founder review preparation.
Scope: fixed SpaceCase repository, exact PR/head, fixed validate.yml workflow, latest attempt per push/PR event, bounded public reads and changed-snapshot detection.
Out of scope: code review verification, task association, individual test verification, private repository credentials, task approval and release execution.
Acceptance: changed heads, drafts, closed PRs, non-main bases, missing/pending/failed/skipped/incomplete runs remain visible as blockers. A successful workflow alone never grants approval. Public read failures fail closed.
Security: fixed HTTPS endpoints, GET only, no redirects or credentials, seven-second total deadline, bounded 1MiB responses, no source narratives retained.
Validation: deterministic transport tests covering latest attempts, competing events, response binding, truncation, races and upstream failures. Both typechecks, lint, builds and full CI before release.
Documentation: ADR 0021 and this sprint record.
