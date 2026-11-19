# Finance continuation point

Updated 19 November 2026. The annual-activity work is an extension of the Finance programme, not a replacement for the earlier verification tasks.

## Preserved evidence

The user completed the synthetic receipt import/capture/independent verification/allocation journey. TEST-IMPORT-ALLOC-1 was R200.50 invoiced, R200.50 allocated, R0.00 outstanding. A later preview flagged both original entries as possible duplicates; no duplicate re-import was observed. Do not repeat those financial mutations to test navigation.

## Return here after the activity-register build

1. FIN-HOME-01: live desktop/phone/keyboard walkthrough of Overview, invoice and allocation task links. Prior browser connections timed out; CI was not visual acceptance.
2. UX-FLOW-01 / FIN-UX-05: check step hints, upload requirements, preview action, saved-record highlight, repeated View action and reduced-motion behaviour. Keep existing user draft tabs intact.
3. FIN-AUDIT-06: a fresh synthetic receipt review with a saved reason, then verify that reason appears both on screen and in its audit CSV. Older immutable events were not backfilled and retain their historical blanks. Preserve rejection decisions and reasons.
4. Verify Finance/Principal independence, including self-review rejection even with combined permissions; test sign-out and back-navigation/current-access checks. Automated permission tests are evidence with a narrower scope than real role/device acceptance.
5. FIN-UX-02/03: observe a cold-resume read and recovery instructions. Never retry a financial mutation automatically or claim an uncertain write failed.

## Activity build boundaries

ACT-PAY-01: contribution calculator released to isolated Preview; live visual acceptance pending.
ACT-PAY-02: saved school calendar/activity register released to isolated Preview; PostgreSQL CI passed 352 tests and the guarded synthetic-database migration was applied. Live visual/role acceptance is pending because an open Chrome extension panel blocked automation. Initial staff entry uses existing Finance record/read and Principal policy authority. No new administrator/teacher permissions are implied. Stage their distinct school-activity permissions in PEOS before expanding input access.
ACT-PAY-03..05: parent billing authority and accepted plan revisions, private evidence uploads/Finance queue, statement snapshots and notification delivery remain separate pending stages. No bank connection, OCR verification, auto-send, parent charge or Production activation is implied by the activity register.

After ACT-PAY-02 checks and Preview release, resume the Finance acceptance tasks above and continue the parent stages without losing their separate completion status. See FEATURE_COMPLETION_REGISTER.md for exact commit/workflow/release evidence.

Latest release: source 0c1b238c605e99dc8db7867b6f70d954da94fd27, PR #94, workflow 44506695088, flagged Preview dpl_FfN44Kf5NWJUawdfRtjC3LGcRa2z. Existing R200.50 test invoice remained fully allocated on a read-only post-migration check. No live activity/calendar submissions were performed. Resume the acceptance queue above after the extension panel is closed; do not infer a completed UI walkthrough from CI.

Current follow-on slice: ACT-PAY-03-AUTH/READ adds separate expiring billing permission and a learner-scoped read-only parent account, gated until companion PEOS PR #38 and SpaceCase checks/migration/release pass. No access grant or parent charge is created by code deployment. After its role/revocation walkthrough, resume the preserved Finance acceptance queue above. Accepted activity plans, payment proof and statement delivery are still distinct pending stages.


ACT-PAY-03-AUTH/READ release evidence (19 November 2026): source `31204f8fc5d19d0887fcd87fa605d29194550825`, draft PR #95, workflow `44513342676` passed 332 product + 23 service tests (355 total, zero failures/skips), database/runtime/backup-restore checks, typecheck/lint and both builds. Companion PEOS source `27fb7d75b5211c968633193d066278fecb1f07f7`, PR #38, workflow `44513087778` passed 69 tests and migration/type/lint/build checks. PEOS migration `20261119130000_family_billing_authority.sql`, checksum `65de1c0c238664c2469c8e937e53ce9b098cee15586da91a2d3b5e6630f35fb7`, applied only to `peos_finance_synthetic_20261112`; read-back verified checksum and zero billing grants. No SpaceCase migration was needed for the account view.

Coordinated isolated Preview release: SpaceCase READY `dpl_Bf7TKcpR7VBZPMTEwbbWNRHBJa4s` at the tested source SHA; PEOS READY `dpl_CrkSgh4u6qbUiAxYYRxZq5nLjfqC` at its tested SHA. Enabled SPACECASE_FAMILY_FINANCE_ENABLED and PEOS_FAMILY_BILLING_ENABLED only for their isolated Preview targets. SpaceCase Preview PEOS_BASE_URL is pinned to the companion Finance authority alias. Stable entry: https://spacecase-finance-test-git-feat-1e5700-tuxfastai-3244s-projects.vercel.app/parent/finance ; companion: https://peos-finance-test-git-feature-f-493e15-tuxfastai-3244s-projects.vercel.app . Deployment does not grant access. No grants, charges, financial mutations, parent messages, evidence uploads or statements were created. Production unchanged.

Live acceptance remains pending: the browser listed the parent route with title Your school account, but inspection timed out on 19 November; that title is not proof of account contents, layout or the two-role grant/read/revoke journey. Do not treat deployment or CI as visual/role acceptance. Next: complete that walkthrough when browser inspection works, including keyboard/mobile and revocation; then ACT-PAY-03-PLAN structured eligibility, invoice/charge deduplication and immutable accepted plans. ACT-PAY-03 overall remains partial; private proof and statement delivery remain ACT-PAY-04/05. Preserve the earlier Finance queue in FINANCE_CONTINUITY.md.
