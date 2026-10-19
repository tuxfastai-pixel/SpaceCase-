# ADR 0006: Dated class attendance belongs to SpaceCase

Status: Accepted

PEOS remains the canonical authority for school, teacher assignment and learner enrolment. SpaceCase owns attendance registers and marks in its dedicated learning schema. Runtime fetches fresh teacher-only rosters from PEOS; it stores canonical IDs, statuses, editor and timestamps, without duplicating learner names.

A class/day has one revisioned register. A transaction-scoped advisory lock and expected revision serialize concurrent writers; stale revisions return conflict rather than overwrite. Saves require the exact current learner set. Previously saved marks for former learners remain retained but are omitted from current-roster views. Attendance dates use the configured school timezone and cannot be in the future. The current class list is explicitly shown for earlier days; historical enrolment reconstruction is deferred.

Unmarked is distinct from Absent. First saves never infer attendance, and bulk-present only changes Unmarked entries before review. Updates require a bounded correction reason instead of private narrative. Atomic audit events preserve actor, date, revision and mark changes. Records are school-operational facts, with no Atlas transfer, diagnosis or automatic messages.

The new tables are private with PUBLIC privileges revoked. A restricted runtime role receives only SELECT/INSERT/UPDATE. API and service scope checks remain required, since operational storage uses a server role rather than browser access. Existing rows are never reset during rollout. Rollback uses application deployment rollback; do not drop attendance tables.
