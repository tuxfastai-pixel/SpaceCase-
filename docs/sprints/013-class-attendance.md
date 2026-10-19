# Sprint 013 — Daily class attendance

Goal: let an assigned teacher save and correct a dated class register without default absences or silent overwrites.

Scope: Present, Absent, Late, Excused and explicit Unmarked; school timezone; current PEOS roster; full-roster validation; dated saved registers; correction reason; audit; teacher dashboard and class links. No medical/free-text notes, parent messages, cross-product transfer, historical enrolment reconstruction, school calendar, absence analytics or administrator overrides.

Authorization: every read/save introspects the session and fetches the teacher-only class roster from PEOS without caching. Paginate up to 1,000 learners, reject incomplete/duplicate/mismatched results. Client IDs alone grant no access. Validate exact current learner set on save. Only the current roster is returned; former learners' saved marks remain stored without exposure to current class users. Request-time PEOS checks and product commits are separate transactions; there is no distributed lock across the independent services.

Acceptance: blank dates resolve to the school's current local day; future dates rejected; new learners start Unmarked; explicit review before save; no automatic parent delivery; revision conflict refuses stale writes; uncertain save disables editing until reload; current class access required; school/class workspace required. Logs/audit hold IDs and before/after marks, never copied learner names or admission numbers.

Validation: unit tests for calendar/timezone, payloads, current roster, pagination, revocation, CSRF, failure minimization; PostgreSQL integration for atomic persisted saves/corrections, concurrent writers, scope, retained former-learner marks and audits; checksum migration 0007 on an isolated Neon branch before production. Verify the restricted production runtime grants SELECT/INSERT/UPDATE on the new private tables, without DELETE. Production readiness includes both tables and their runtime read permissions.
