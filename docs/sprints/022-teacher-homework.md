# Sprint 022 — Teacher homework

Goal: teachers can prepare, assign and track homework for their actively assigned class without AI or family delivery dependencies.

Scope: private teacher-owned tasks; drafts with title, subject, instructions, school-local assigned and due dates; assign, close and reopen transitions; current-roster completion register; reasons for corrections; immutable revision events and recent history; paginated task list. Dashboard links appear for configured assigned classes.

Out of scope: automatic email, learner/parent delivery, uploads, AI marking, assessment marks, administration impersonation and cross-teacher sharing. Assign means recorded in the teacher workspace, not delivered. Schools continue using their normal instruction-sharing channels.

Failure analysis: repeated submissions must not create duplicate tasks; new-draft UUID persists across retries. Revision comparison and a transaction-level task lock prevent lost edits. Assigned instructions cannot be changed retrospectively. Closing blocks outcomes until explicit reopen. PEOS authorization runs on every request, and current roster bounds every completion save. Former learner records remain retained but are removed from detail responses. No names or homework narrative are copied into audit events. Due dates never automatically determine learner outcomes.

Acceptance: current assignment required; cross-school/class/teacher requests cannot read tasks; inactive local workspaces deny writes; drafts cannot accept outcomes; due dates validate; missing/foreign roster entries deny saving; concurrent writes have one winner; correction retains previous status; event table has no runtime UPDATE/DELETE permission; production readiness checks both tables.

Validation: contracts and HTTP tests plus isolated PostgreSQL integration test. CI applies migration 0014 and verifies runtime privileges before running the complete test suite and both app builds. No live school records or delivery service required.

Release: additive migration 0014 must precede application promotion. Existing task instructions are fixed after assignment. An administrator cannot see these teacher-private records through this surface. Retention/export policy and guardian delivery remain separate work.
