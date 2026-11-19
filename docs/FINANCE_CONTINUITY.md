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
