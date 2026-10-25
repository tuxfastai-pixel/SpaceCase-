# Sprint 048 — Family profile draft foundation

Goal: implement the agreed guided family intake without pretending guardian verification exists.

Scope: six-step signed-in draft UI (parent details, child names/DOB and calculated age, school connection hints, optional additional adults, optional address/contact preference, review); up to five children/five additional contacts; single adult accepted; optional fields remain blank for later completion. Add contextual help, draft save/reload, conflict pause and clear with confirmation. Add owner-only API, isolated draft schema migration 0016, metadata-only atomic audit and tests. Family entry is available from the teacher dashboard and its no-assignment status, plus parent help.

Failure analysis: self-claimed guardianship unlocking records; duplicate canonical learner creation; data copied to logs/browser storage/URLs; wrong owner supplied in JSON; cross-origin mutations; invalid DOB; lost local edits; stale tabs restoring cleared details; optional absent parent blocking intake; fictitious review/submission success; metadata edits mistaken for contact verification.

Acceptance: auth required; owner derived from introspected session; only own draft readable; strict schema/size bounds; stale mutations fail; no school or PEOS write; clear retains monotonic revision and metadata audit; photos optional but not collected in this stage; honest unavailable submission action and parent portal notice; UI states describe exact save status; loss warning before navigating away.

Out of scope: school submissions/review queue, verified guardian grants, live learner lookup, photo uploads, document identity evidence, automated emails/AI or parent record views. These are later builds, not completed by saving a draft.

Validation: focused contract/HTTP tests; CI PostgreSQL isolation, race, stale-clear/tombstone and audit tests; typecheck/lint/build; synthetic actual-component browser flow before release.

Release gates: migration 0016 approved and applied to intended production DB, retention/operator policy confirmed, tested source release separately approved. No production database, credentials, guardian roles or deployment changed by this sprint. Rollback hides intake route/links; retain draft storage for an explicit owner-governed cleanup. See ADR 0027.
