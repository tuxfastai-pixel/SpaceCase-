# Sprint 031 — Saved engineering task controls

Founder engineering desk lists saved task metadata by ticket, paginates 25 records at a time, distinguishes blocked/cancelled states and reports brief expiry. Cancellation remains available for closed tickets and preserves audit history. Saving a reviewed task refreshes the list.

A dedicated signed control protocol binds each operation to the founder, source, task revision and thirty-second validity. Product acknowledgements are checked against the requested source/task/revision. Cancellation is atomic and replay-safe at the HTTP boundary; no brief retrieval endpoint or agent execution is introduced.

Validation: strict transport tests, product authority/acknowledgement tests, service endpoint denial tests, PostgreSQL integration tests for source isolation, pagination and concurrent cancellation, typechecks, lint and production builds. PostgreSQL integration checks require the CI test database; local runs without it explicitly skip those checks.
