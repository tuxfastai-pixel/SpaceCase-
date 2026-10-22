# Sprint 029 — Founder saves and retained-brief expiry

Goal: complete explicit save/retry controls and enforce reviewed-brief retention.
Scope: founder save component, stable attempt/acknowledgement binding, storage status, separate result contract, seven-day content expiry, bounded authenticated daily cleanup, dedicated storage rollout.
Out of scope: autonomous code execution, paid models, repository changes by agents and automatic releases.
Acceptance: copy/prepare stay ephemeral; consent and exact commit required to save; ambiguous results retain the same attempt and freeze the draft; expired content is unavailable and cleared without deleting idempotency/audit tombstones; runtime cannot extend retention or restore content; cleanup is safe under concurrent calls. No preview production access.
Validation: save-attempt unit tests, real PostgreSQL expiry/idempotency/permission/concurrency tests, HTTP cron denials, phone-width synthetic browser save/retry checks, both builds/typechecks, lint and full CI. See ADR 0017.
