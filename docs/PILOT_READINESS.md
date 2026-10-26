# Supervised school pilot readiness

Assessment date: 26 October 2026. Engineering planning estimate: **approximately 70% of preparation for a small supervised teacher/administrator pilot**. This is not a measured test pass rate, completion of the full product roadmap, school certification or authorization to launch. Reassess after each pilot acceptance run; do not raise the score merely because a guide or checklist was added.

## Scope of this estimate

A small invited group tests school/class setup, manually shared staff invitations, assigned teacher workflows, attendance, planning, homework, observations, private photo uploads/manual marking, progress summaries and support. Optional family testers can exercise private drafts and school contact requests; actual parent school-record views remain excluded. A technical owner and a school coordinator supervise the pilot, with the school's normal records/processes continuing.

## Planning rubric

Weights express importance to this pilot, not lines of code or completed sprint count. Awarded points are engineering judgments from the recorded implementation/release evidence, discounted for missing live proof. They must not be presented as telemetry.

| Area | Weight | Estimated points earned | Evidence and remaining work |
| --- | --- | --- | --- |
| Identity, school setup and staff/class authority | 20 | 16 | PEOS-backed setup/invitation/assignment flows exist; confirm intended accounts, school configuration and live revocation |
| Core teacher day | 30 | 27 | Attendance, planner, homework and observations implemented; complete current role/phone regression walkthroughs |
| Assessment capture, manual marking and progress summaries | 15 | 12 | Capture/matching/manual review flows exist; verify private storage, interrupted phone uploads and print behavior |
| Feedback and operational handover | 10 | 9 | Support/observer/founder workflows exist; guide/checklist added; confirm actual support ownership and response loop |
| Live acceptance, recovery and release verification | 25 | 6 | CI/releases/health evidence exists; signed-in cross-role run, representative phones and isolated restore/rollback proof remain incomplete |
| Total | 100 | 70 | Approximate supervised-pilot preparation estimate only |

## Mandatory decisions before school testing

1. Confirm participating school/accounts, pilot coordinator, support contact, testing window and allowed workflows. No unapproved production test identities.
2. Complete the pilot school's workspace, class, teacher assignment and authorized roster checks.
3. Run actual role isolation/revocation, save/reload and private upload checks. Fix critical access, data-loss or incorrect learner/page-association problems before those workflows are used.
4. Record isolated recovery/rollback evidence and the incident response owner. Never run a destructive production drill to get a checkmark.
5. Explain limits to the school and keep the ordinary school process available. Document excluded features and unresolved issues.

The public /pilot checklist helps organize observations. It is temporary/self-reported and cannot substitute for the evidence above. Agreement to a pilot and applicable data-handling arrangements must be handled with the school; this page does not accept terms for them.

## Features that need not block this limited pilot

Automatic invitation email can remain manual. AI reading/proposed marking can remain off while teachers mark manually. Atlas, payments, penalties, autonomous engineering, official term reports and a full parent record workspace remain outside the agreed pilot. If the pilot is intended to test any of these specifically, their activation/acceptance requirements become blockers and this 70% estimate no longer describes that scope.

Read [the completion register](FEATURE_COMPLETION_REGISTER.md) for the remaining work and the stable QA/feature IDs. Use /pilot for role walkthroughs and Report an issue / My requests for authorized school feedback.
