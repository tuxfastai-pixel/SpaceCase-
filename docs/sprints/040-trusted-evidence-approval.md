# Sprint 040 — Trusted evidence verification and guarded founder approval

Goal: offer approval only after live proof checks and an independent authorized human review.

Scope: bounded public GitHub verifier, optional read-only thread adapter, artifact byte hashing, exact-head/attempt test validation, explicit reproduction/rollback attestations, current source/task/expiry checks, proof-bound approval store, founder verification reasons and explicit confirmation/retry.

Out of scope: paid AI, automated agents, provisioning GitHub credentials, self-review, diagnosis of school data, automatic deployment/merge, binary uploads and irreversible-data-change approval.

Acceptance: no missing/partial/stale/changed facts can approve; packets never assert their own verification; unknown collaborators/bots/self-review do not count; successful CI is insufficient without explicit packet attestations; files match exact SHA-256; inline threads must be confirmed resolved or approval blocks. A final decision re-verifies facts, rechecks task/source and locks unexpired evidence. One approval/audit event per identical request, including concurrent retries; changed payload rejected across decision stores. Release/execution permissions stay false.

Security: PEOS founder authority and same-origin product boundary retained, signed source/intent/evidence ID, fixed repository/origins, complete bounded enumeration, no narrative forwarded, restricted new table grants, old non-approval constraint unchanged. Optional token stays server-only and is not provisioned automatically.

Tests: mocked authoritative GitHub records/bytes, trust/identity, pagination, review/thread changes, rerun attempts, hash mismatch, rate limits, missing jobs, authorization/ack binding; real PostgreSQL proof constraints, expiry races, concurrent approval/retry and audit projections; both typechecks, lint/builds, responsive synthetic UI ready/blocked/confirmation/retry paths.

Documentation: ADR 0025 includes reviewer protocol, connection limits, retention and rollout/rollback.
