# Finance continuation point

Updated 19 November 2026. Parent activity planning extends the Finance programme and does not replace the earlier acceptance queue.

## Preserved evidence

The user completed the synthetic receipt import/capture/independent verification/allocation journey. TEST-IMPORT-ALLOC-1 was R200.50 invoiced, R200.50 allocated, R0.00 outstanding. A later preview flagged both original entries as possible duplicates; no duplicate re-import was observed. Do not repeat those financial mutations to test navigation.

## Return here after the activity-register build

1. FIN-HOME-01: live desktop/phone/keyboard walkthrough of Overview, invoice and allocation task links. Prior browser connections timed out; CI was not visual acceptance.
2. UX-FLOW-01 / FIN-UX-05: check step hints, upload requirements, preview action, saved-record highlight, repeated View action and reduced-motion behaviour. Keep existing user draft tabs intact.
3. FIN-AUDIT-06: a fresh synthetic receipt review with a saved reason, then verify that reason appears both on screen and in its audit CSV. Older immutable events were not backfilled and retain their historical blanks. Preserve rejection decisions and reasons.
4. Verify Finance/Principal independence, including self-review rejection even with combined permissions; test sign-out and back-navigation/current-access checks. Automated permission tests are evidence with a narrower scope than real role/device acceptance.
5. FIN-UX-02/03: observe a cold-resume read and recovery instructions. Never retry a financial mutation automatically or claim an uncertain write failed.

## Current build status

ACT-PAY-01 contribution calculations and ACT-PAY-02 saved school calendar/activity register are released only to isolated Finance Preview. Current staff input uses existing Finance read/record and Principal policy permissions; administrator/teacher activity permissions remain separate future work.

ACT-PAY-03-AUTH/READ: separate current Principal-controlled billing authority and learner-scoped parent account released to paired isolated Preview services. ACT-PAY-03-PLAN-CORE/FLOW: existing-invoice eligibility links, parent choices, server preview, immutable annual plans, status recovery and saved-record guidance released to isolated Finance Preview. New plan permission is explicit; existing read-only grants are never upgraded automatically. No hosted plan/link/grant was seeded. Full role/device live acceptance remains pending.

ACT-PAY-03 still needs optional event participation/new charge issuance and contribution/top-up allocation intentions; selecting an already-invoiced activity for a plan does not create a charge, cancel other fees, establish attendance consent or verify money. ACT-PAY-04 private proof/quarantine/Finance queue and ACT-PAY-05 ledger statements/notification delivery remain pending. No bank connection, OCR verification, external message or Production activation is implied.

See FEATURE_COMPLETION_REGISTER.md and FAMILY_ACTIVITY_PLAN_IMPLEMENTATION.md for exact implementation, CI, migration and deployment evidence. Resume the preserved Finance queue after the current parent/Principal walkthrough, without repeating settled synthetic allocations.


ACT-PAY-03-PLAN-FLOW release evidence — 19 November 2026: tested implementation `7bc3b1a446e3f7d94b1e546aa96b2fee31614029`, PR #96, workflow `44576561453`, job `135745502691`: 342 product + 23 service tests passed (365 total, zero failures/skips), all migrations/runtime/backup-restore checks, typecheck/lint and both builds. Protected development branch advanced after CI. Existing companion PEOS family-billing-v1 source `27fb7d75b5211c968633193d066278fecb1f07f7` is unchanged; no new PEOS deployment or migration was required, and no grants were created.

Exact migration `20261119150000_family_activity_plans.sql`, checksum `52608d2d2f634571071217d8660537f0b75861cf4523c506117c9534d888f9f1`, applied transactionally only to isolated `spacecase_finance_synthetic_20261112`, after the same schema passed full CI. The initial multi-command prepared-statement attempt failed and was verified to leave no tables/journal entry; statements were then submitted separately in one guarded transaction. Read-back verified checksum, zero plan/link rows, and effective runtime UPDATE/DELETE denial on both tables. TEST-IMPORT-ALLOC-1 remained 20050 cents invoiced and allocated. No hosted family plan, invoice link, charge, receipt, allocation or billing permission was created.

Enabled SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED only on the isolated Finance project's Preview target, with existing Finance/activity/family gates. READY flagged deployment `dpl_GCoc3B6Ei9m5vuXuNii428atH7ju` at the tested implementation SHA assigned to https://spacecase-finance-test-git-feat-1e5700-tuxfastai-3244s-projects.vercel.app ; alias identity/READY/Preview target read back. Parent entry is /parent/finance; staff links are Activity planning → Saved activity links; explicit plan authority is Review & reconcile → Family billing access. Code defaults remain off elsewhere. General Preview databases and Production configuration were not changed. Git-linked companion project Preview builds may run automatically when the development branch advances; that does not activate their default-off plan feature.

Live acceptance is still pending: browser tab creation timed out in focus control; recovery inventory showed only an un-navigated about:blank tab. No live page contents, parent/Principal journey, phone/keyboard/reduced-motion interaction or saved-plan highlight was observed. CI and READY deployment are not that evidence. Next: controlled school contact → explicit plan grant → published activity/existing eligible invoice link → parent preview/agree → saved revision/highlight/status recovery → revoke/cross-family walkthrough. Do not repeat the settled R200.50 allocations. Earlier Finance acceptance queue remains FINANCE_CONTINUITY.md. Optional event enrolment/new charge issuance and contribution/top-up allocation intentions remain pending within ACT-PAY-03; private proof, independently verified receipts, statements and notifications remain ACT-PAY-04/05. No messages or Production changes.
