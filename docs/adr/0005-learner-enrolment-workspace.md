# ADR 0005: Learner enrolment, rosters and explicit workspace readiness

Status: accepted.

This milestone supplies a usable administrative class roster and a read-only teacher roster. PEOS owns learner identity names, school registration references, organisation membership and class enrolment. SpaceCase owns local workspace settings and future learning records; it never queries PEOS tables directly.

Class administration links to /admin/learners/[schoolId]/[classId]. Administrators can register one learner or import a CSV with admission_number,given_name,family_name, up to 50 rows and 64 KB. Parsing happens locally, preserves leading zeros in references and supports quoted/Unicode names. Extra data columns, malformed CSV and unsupported references are rejected. Review allows correction and exclusion; duplicate references and invalid rows cannot be submitted. Only selected validated rows leave the browser. Results distinguish new registration, existing enrolment, repeat and reference conflict. A school reference identifies a learner only within that school; never match/merge across schools on names. No learner accounts or guardian relationships are inferred. Name/reference correction, school transfers and withdrawal remain future lifecycle work.

Teachers open /classes/[schoolId]/[classId] from their assigned classes. Roster access is rechecked by PEOS for exact class, current role, school membership and assignment. Admin-only write controls are omitted from teacher views and PEOS independently rejects writes. Rosters have bounded 100-row pages and manual refresh; no learner names in URLs, localStorage, analytics or logs.

POST/GET /api/v1/admin/schools/[schoolId]/workspace first verifies the PEOS session and current school administrator directory. Workspace setup accepts only timezone and academicYearLabel; it obtains class IDs from PEOS rather than user input. It writes local settings/classes and an audit event in one product transaction. Cross-school class bindings roll the transaction back. It configures at most the 200 classes returned by the bounded current directory.

/api/ready probes the product connection, required tables and runtime SELECT privileges. It explicitly refuses a database containing canonical PEOS identity/organisation tables, preventing accidental learning-storage reuse. Public responses contain ready/not_ready only. Connection and query waits are bounded; no connection strings or upstream error bodies are exposed. This is a storage probe, not a backup-restoration or full application readiness certificate.

Production remains in authority_only until the dedicated product database, all repository migrations and real workspace settings are verified. Enrolment and rosters operate through PEOS independently; this does not activate learning tools. Workspace setup reports storage unavailable truthfully. Never auto-switch mode after a database failure and never migrate the PEOS database with SpaceCase migrations.

Acceptance: all CI migration/type/lint/test/build gates, PostgreSQL workspace persistence/scope rollback tests, enrolment authorization/concurrency tests, CSV review tests, runtime authentication/CSRF probes and storage probe. Real student data is not inserted during release verification. Future onboarding can compose these administration modules without inventing school policies.
