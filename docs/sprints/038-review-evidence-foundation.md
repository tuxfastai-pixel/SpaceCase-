# Sprint 038 — Review evidence foundation

Goal: define and verify evidence without converting user assertions into approval authority.

Scope: strict, bounded evidence packets; exact task/source/head binding; deterministic packet digest; server-only verifier interface; independent review, complete thread enumeration, acceptance proof and rollback gates; fail-closed results.

Out of scope: persistent evidence storage, uploads, browser editor, live GitHub provenance adapter, approval activation, database migrations, credentials, paid inference and deployment execution. These remain follow-on integration work; this sprint is not the complete evidence workflow.

Acceptance: collection remains UNVERIFIED; stale input is rejected before external verification; receipts must match the complete binding and packet digest; unavailable/incomplete proof cannot pass; no result grants approval/release/execution. GitHub identities stay external numeric IDs.

Security: internal server adapter only, no client-supplied verified flags, no arbitrary URLs, synthetic/redacted proof only, founder check before adapter calls, detached adapter input, generic upstream errors. Final integration must reauthorize through PEOS and recheck mutable source/task state.

Tests: strict input/size/privacy checks; every binding dimension; lifecycle authorization; independent exact-head review; thread completeness and findings; artifact coverage; acceptance failure/unrun; rollback impact; adapter failure and mutation. Run existing review policy tests, both TypeScript checks and lint.

Documentation: ADR 0023 explains provenance limits and the remaining production integration.
