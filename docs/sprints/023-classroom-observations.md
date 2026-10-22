# Sprint 023 — Classroom observations and follow-up

Goal: record factual classroom observations and teacher support actions, including positive achievements, without automatic labels, diagnosis or communication.

Scope: teacher-private notes linked to one current PEOS class learner; positive, learning support and behaviour support categories; observation date, classroom context, observable evidence, response, next step and optional follow-up date. Open, resolve, reopen or retract records with revision checks. Filter by current learner and state, paginated list, visible recent revision history.

Out of scope: disciplinary scoring, diagnoses, safeguarding case management, automatic escalation, parent messages, automated reminders, AI processing, Atlas updates and school-wide access. Urgent concerns use established school procedures, not an unmonitored classroom notebook.

Failure analysis: class IDs alone do not authorize access. Every request checks authenticated PEOS teacher authority and obtains the current canonical roster. A former learner's records are excluded from reads and denied for updates. Reassignment to a different teacher never transfers private notes implicitly. Invalid future observation dates fail in the school timezone. Stable client UUID prevents duplicate creation after an ambiguous response. Transaction locks and revision checks prevent overwrites. Retraction is explicit and terminal; corrections preserve the previous saved content in append-only revisions. Narrative never goes to ordinary audit metadata or logs.

Acceptance: identity comes only from PEOS; no new learner identity table; no cross-teacher/class/school reads or writes; current roster bounds all actions; local inactive workspace denies access; positive/support notes validate; resolution requires outcome; resolved entries require reopening before edits; retracted entries cannot be modified; previous revisions are retained; runtime cannot update/delete revision history or delete records. Overdue follow-up dates are informational.

Tests: strict input and HTTP authorization/stream bounds tests; isolated PostgreSQL tests for scope, current roster filtering, concurrent writes, transitions, correction snapshots, future dates and audit minimization; migration privilege checks; typecheck, lint, full suite and both production builds. No real learner records or model calls.

Release: additive migration 0015 precedes application promotion. Privacy-sensitive teacher notes remain outside founder summaries, family communication and Atlas. Existing retention/export governance applies; no automatic purge is introduced.
