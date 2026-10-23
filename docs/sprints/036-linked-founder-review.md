# Sprint 036 — Founder linked review summary

Goal: show a concise summary of current evidence without repeatedly entering PR and commit details.
Scope: on-demand saved-link inspection, source/task/head/base/expiry/workflow blockers, bounded recent decisions and digest-bound snapshots.
Out of scope: retrieving briefs, inventing change explanations, inferring reproduction or rollback success, and automated code review.
Acceptance: current head changes are visible; unavailable GitHub evidence is a blocker; source revision changes alter the digest even when already marked stale. Re-reading identical evidence leaves the digest stable. No raw narrative or actor identifier appears in responses.
Security: source-scoped founder reads and bounded transactions; no locks held over network calls; no polling.
Validation: snapshot-binding, privacy and retention tests, browser state and mobile layout checks, full CI.
Documentation: ADR 0022.
