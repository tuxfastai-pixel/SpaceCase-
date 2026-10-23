# Sprint 041 — Managed GitHub thread verification

Goal: use the founder-installed read-only App to verify resolved review threads without a persistent provider token.

Scope: server-only PSG credential adapter, lazy verifier credential seam, pinned installation/tenant/project/environment, bounded cancellation, fail-closed metadata validation, SDK dependency and tests.

Out of scope: repository writes, triggers, automatic execution, deployment authority, paid services, learner data access and database changes.

Acceptance: disabled/wrong environment performs no exchange; only the dedicated app installation is requested; cache does not preserve a revoked grant across new verifications; credentials reach only fixed GitHub GraphQL; missing/expired/mismatched/failed/cancelled exchange blocks; public REST and no-comment flows remain credential-free; independent current-head human review and all other proof gates still apply.

Validation: targeted credential and verifier tests, both typechecks, lint, both builds, full CI with PostgreSQL before release. Production token exchange and signed-in founder walkthrough remain pending; do not claim an end-to-end pass from synthetic tests.

Release gate: explicit approval for attaching this connector to PSG production only, activating the flag, and deploying the tested service. No schema changes. See ADR 0026.
