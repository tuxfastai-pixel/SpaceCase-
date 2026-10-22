# Sprint 030 — Exact-commit review readiness

Goal: codify review/decision boundaries before runner integration.
Scope: strict project-bound evidence contract, source/head/check binding, independent review and reproduction/rollback requirements, digest-bound founder decision preparation and denial tests.
Out of scope: evidence provenance adapters, persistent approvals, approval UI, runner/model access, release execution and deployments by agents.
Acceptance: changed source/head, expired brief, self-review, pending/skipped/failed validation, unresolved findings and missing reproduction/rollback block approval. Wrong review digest or non-founder context fails. Every prepared decision explicitly grants no release permission.
Validation: synthetic policy tests, typechecks/lint/build and full CI. See ADR 0018.
