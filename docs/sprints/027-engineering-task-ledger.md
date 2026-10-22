# Sprint 027 — Durable engineering ledger foundation

Goal: persist reviewed task identity and audited cancellation without granting execution.
Scope: isolated PSG SQL migrations and checksum runner; internal ledger save/cancel services; separate disposable CI database; explicit runtime grants and concurrency tests.
Out of scope: UI save control, public API, production database provisioning, worker claims, leases, agents, sandbox execution, paid inference and automatic repair/release.
Acceptance: fresh founder/current open-source revision and canonical digest required before save; immutable exact commit; request-id conflict denial; identical work converges on one task; cancelled work stays cancelled; revision-bound cancellation is atomic with audit. Runtime cannot overwrite briefs or alter/delete event history. No school database migrations added.
Validation: service authorization unit test; real Postgres integration under restricted role, concurrent/restart/cancel scenarios; both workspace typechecks, lint and builds, full CI. See ADR 0015.
