# Class creation and teacher assignment

## Goal and ownership

School administrators create named classes for an academic year, select active school teachers and assign/remove classroom access. Teachers see the actual class names after refreshing. No production classes or assignments are fabricated during rollout: administrators enter their real classroom information.

PEOS owns classes, school staff roles and teacher assignments. SpaceCase proxies versioned APIs with the current session and same-origin checks. No direct product writes to canonical tables are allowed. Learner enrolment, teaching tools, class archiving/renaming, school transfers and automated email remain outside this slice.

## Contracts and security

GET/POST /v1/admin/schools/[schoolId]/classes lists the scoped directory or creates a class. POST /classes/[classId]/teachers assigns a teacher; DELETE /classes/[classId]/teachers/[teacherPersonId] ends assignments. All endpoints use current administrator checks and audit allow/deny outcomes. Names and years are bounded; input rejects authority fields. Creation serializes duplicate normalized names per school/year. Assignment serializes teacher/class changes and is idempotent. The teacher must be a current active person, school staff member and holder of the scoped TEACHER role. Cross-school classes or teachers are denied. Directory results are bounded to 200 classes and teachers; labels from accepted invitation emails are display-only, never authorization.

Teacher context requires a current TEACHER role and returns actual assigned class names and years, with same-school checks and deduplication. Removing an assignment stops it appearing on subsequent context reads and stops learner access derived from that assignment. Authentication, membership and role remain independently required. No learners or educational records are created by assigning a teacher.

## Operational storage readiness

SPACECASE_WORKSPACE_MODE defaults to operational, preserving existing storage-backed behaviour and 503 failures when storage is unavailable. Production is explicitly placed in authority_only for the class-setup pilot because the separate school-learning database has not been verified ready. This is configuration, not automatic failure recovery. Current PEOS authority must still resolve on every read. Assigned teachers receive CLASSROOM_SETUP_REQUIRED with only their actual class metadata; schoolWorkspace.configured=null means not inspected. The interface says classroom tools and learner records are still being set up, with no working-tool or database-health claims. Zero-class teachers retain CLASS_ASSIGNMENT_REQUIRED.

Switch to operational only after the dedicated SpaceCase database, migrations and real workspace configuration have been verified. The PEOS database is not used as a learning-record database. Configuring a connection failure must never silently activate setup-only mode.

## Acceptance and verification

CI validates migrations, typecheck, lint, build and PostgreSQL security tests. Tests cover unauthorized administrators, cross-school identifiers, non-teacher staff, future membership, duplicates/concurrent requests, correct names in teacher context, malformed cross-school assignments, immediate removal, ended roles and audit. SpaceCase tests cover explicit setup mode without learning-storage calls, mismatched identities, class-metadata filtering and default operational failure behaviour. Browser acceptance: create a real class, assign an accepted teacher, refresh that teacher's dashboard, then remove the assignment and refresh again.
