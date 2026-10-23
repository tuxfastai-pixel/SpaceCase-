# Sprint 034 — Founder repository workflow inspection

Goal: make exact-commit workflow observations useful in the founder desk without introducing an approval shortcut.
Scope: on-demand founder-only form, explicit expected head, public GitHub reader, typed response binding, human-readable blockers and safe links to runs.
Out of scope: saved task association, durable approval records, review automation, execution, GitHub writes, credentials, upgrades and polling.
Acceptance: fresh PEOS founder authority and same-origin POST precede reads; injected fields fail; form changes clear the old snapshot; hidden/unmounted forms abort pending UI requests; mismatched acknowledgements fail. Results explicitly distinguish workflow conclusions from individual tests, reviews and task approval.
Security: no school, learner, ticket or brief data leaves SpaceCase. Only the entered PR number and repository commit metadata are sent to fixed GitHub public endpoints. No database access is required by this operation. Rate limits fail with an explicit retry-later message.
Validation: authority/transport tests, synthetic browser walkthrough at phone widths, both typechecks, lint/builds, full PostgreSQL CI and code review.
Documentation: ADR 0021 and sprint 033 describe the reader; this record covers its product boundary.
