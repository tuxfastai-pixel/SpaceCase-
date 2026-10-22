# Sprint 028 — Authenticated engineering save adapter

Goal: replace trust in caller-supplied authority with a purpose-scoped signed product attestation for blocked task storage.
Scope: founder API save action with explicit storage consent; fresh product authority/source checks; versioned Ed25519 protocol and limits; PSG storage endpoint; isolated runtime pool; privacy, transport, signature and two-database integration tests.
Out of scope: production activation or provisioning, frontend save flow, retention purging, agent execution, worker claims, repository/model credentials and release gates.
Acceptance: signed payload fixes actor/work/purpose/audience and expires in 30 seconds; no login credentials or raw ticket narrative transferred; redirects and previews denied; unsigned/forged/expired payloads fail before storage; stable request UUID provides idempotent retries; acknowledgement must match the submitted work; all responses explicitly executionStarted=false. The source is rechecked at issuance; later execution cannot rely on this snapshot.
Validation: contract and HTTP authorization tests, product-to-PSG-to-Postgres synthetic integration, both typechecks/builds, lint and full CI. No live data/model calls. See ADR 0016.
