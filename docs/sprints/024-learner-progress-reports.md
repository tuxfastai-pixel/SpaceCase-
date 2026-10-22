# Sprint 024 — Learner progress reports

Goal: give an assigned teacher a printable factual learner summary from saved records.

Failure analysis: the daily hub only contains counts; it cannot establish an individual learner's progress. Combining marks across unrelated assessments, interpreting missing attendance as absence, or treating private teacher notes as family-ready content would mislead users.

Scope: current class and learner authority rechecked per request; explicit date range of up to 366 days; saved class attendance counts; only requesting teacher's current approved results filtered by approval date in school timezone; print/PDF via browser. Current-roster history limitations and corrections moving approval periods are visible. More than 200 results disables printing and requests a narrower range.

Out of scope: official term grades, subject weighting, rankings, AI commentary, stored report drafts, email delivery, historical enrolment reconstruction, private observations, other teachers' results and Atlas data.

Acceptance: report has clear learner/reference/class/date context; stale report clears when selection changes; denied/revoked authority never reaches storage; unknown records are not invented; drafts and AI proposals excluded; reads audited without report content in audit metadata. Print excludes controls and distinguishes absent from unmarked. Report output cannot contain unexpected narrative fields.

Validation: HTTP authority/input/privacy tests; database isolation and current-result correction tests; typecheck/lint/build; CI with database. No migration or production record writes are needed, apart from read audit events. Email and AI remain disabled. Physical-phone print behavior requires user validation.
