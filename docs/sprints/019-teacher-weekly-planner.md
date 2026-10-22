# Teacher weekly lesson planner
Goal: replace the lesson-planning placeholder with a useful class-linked weekly workflow.

Scope: teacher-private plans, Monday–Sunday navigation in school timezone, up to 50 lessons per week, draft/ready/taught states, objectives, activities, resources, reflections, explicit save, removal, save-conflict detection, and metadata audit.

Out of scope: AI generation, curriculum alignment, timetable integration, collaboration, administrator inspection, homework publication, learner data, external notifications, automatic retention or claims about measured teaching outcomes.

Failure analysis: class identifiers confer no authority; every read and write resolves the session and current PEOS teacher assignment. Founder, observer and agent status alone confer no plan access. Every database query includes teacher, school and class. Local workspace must remain active. Concurrent writes serialize by owner/class/week and check revision. Unknown write outcomes pause editing until reload. Unsaved navigation prompts before discarding. No lesson narrative is copied into audit metadata.

Acceptance: teachers can open Plan lessons beside assigned configured classes, navigate weeks, create/edit/remove lessons and save/reload. Ready/taught lessons require objectives and activities. Invalid dates, duplicate IDs, unknown fields and over-limit input fail. Another teacher receives their own empty plan. Revoked assignment prevents the next request. Conflicting revisions cannot overwrite. Runtime role cannot delete plans or create objects.

Validation: contracts and HTTP boundary tests, database concurrency/isolation/audit tests, migration privilege checks, typecheck, lint, production build. Migration 0011 must precede application release. Existing readiness now requires the planner table. Rollback: revert application only; keep additive table and saved data.

Manual acceptance after deployment: use a genuine assigned teacher account; save a real pilot lesson, refresh, confirm another teacher cannot see it, and open two tabs to test conflict messaging. No seeded lesson content in production.
