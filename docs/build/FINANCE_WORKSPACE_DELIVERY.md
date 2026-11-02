# Finance workspace delivery — 2 November 2026

Goal: connect SpaceCase-owned finance records to current PEOS authority and usable principal/finance workflows. This is a continuation of FIN-A–F, not production activation.

Failure analysis: existing allocations require records that no product route can create; reconciliation review has no UI or evidence snapshot; no current finance-school directory exists; the register still describes only arithmetic. School subscription billing must remain distinct. Never equate reported money with verified settlement or a saved reconciliation with a bank reconciliation.

Implementation groups:
1. Current PEOS finance-school discovery and learner eligibility contract, with expired/revoked/cross-school denial. No grants from navigation.
2. SpaceCase schema and services for invoices/instalments, reported payments and independent verification, budget/expense preparation and independent approval, audited reads and ledger summaries. Preserve exact integer-cent arithmetic.
3. Protected finance API and finance/principal workspace; bounded lists and honest empty/disabled states; account setup requires current principal policy permission.
4. Reconciliation evidence snapshot, immutable submitted records, independent review, and audit trail. Record-ledger review is not a bank-confirmed period close.
5. PostgreSQL migration/integration tests, authorization tests, typecheck, lint and production build; update stable completion IDs. Save reviewed source in feature PRs.

Acceptance: no unverified allocation, no same-person verification/approval, no cross-school records, no browser-supplied actor/verification, no floats, no automatic bank/email/AI execution, no parent finance access without a canonical relationship contract. Read APIs must not leak school data or cache private results. Mutation requests require same origin and bounded input. Audit failure must roll back the record mutation.

Activation dependencies: independently verified principal/finance assignments, principal step-up/recovery policy, approved private evidence storage/retention, isolated migration rehearsal and signed-in multi-role walkthrough. Do not enable production finance from CI alone. Bank collection, debit orders, tax filing, full payroll, automatic sanctions, family submission, AI execution and outbound messaging retain separate activation dependencies.


## Principal-to-finance pilot acceptance gate

Use an isolated preview database and synthetic school, principal, finance officer, finance manager, teacher and second-school identities. Do not use real learner, family, banking or payment data.

1. Provision a school through the authorized school onboarding flow before initializing its finance account. Assert that finance initialization works as `spacecase_runtime` without `school_ops` write permission, and fails cleanly for an unprovisioned school.
2. Sign in as the current principal. Verify that the principal overview links to finance, the finance-school directory includes only schools with current PEOS authority, and an administrator without finance authority cannot obtain the finance workspace.
3. Verify principal-only invitations for `FINANCE_OFFICER` and `FINANCE_MANAGER`; acceptance must bind to the intended identity and school. Test pending-invite revocation, accepted-role termination, expiry and immediate access loss after revocation.
4. Verify finance officer record preparation, finance manager independent payment verification and principal-only expenditure/reconciliation approval. Reject self-review, stale authorization, cross-school identifiers and replayed/duplicate payment references.
5. Verify invoice instalments sum exactly to the invoice, reported payments are not shown as verified, unverified funds cannot be allocated, audit failures roll back mutations and stale reconciliation snapshots cannot be approved.
6. Verify a teacher's dashboard still loads when finance discovery fails or finance is disabled. Test account switching, sign-out, mobile and desktop layouts, and that private financial data is not cached or visible to other school roles.
7. Rehearse migration and rollback against a disposable production-shaped database with the restricted runtime role. Record the migration SHA, database role grants, test results, screenshots and reviewer sign-off before preview activation.

**Preview activation rule:** Set `SPACECASE_FINANCE_WORKSPACE_ENABLED=true` only in an isolated preview environment after the preceding gates pass. Keep production false; never enable real financial processing from a successful CI run alone. Principal step-up/recovery, evidence retention and human sign-off remain mandatory production gates.


## Cross-system preview evidence record (release blocker)

Do not mark this gate passed using mocked PEOS decisions or independent repository CI. Run both feature heads against disposable, isolated databases with synthetic identities. Record the exact SpaceCase and PEOS commit SHAs, database migration checksums, environment name, tester, UTC timestamp, and test evidence links. Never store tokens, passwords, actual learner records or banking information in this document.

| Scenario | Required observable result | Evidence / reviewer | Status |
| --- | --- | --- | --- |
| Principal login and school discovery | Only currently authorized schools listed; principal can enter finance | Pending | NOT RUN |
| School administrator / teacher login | No finance directory access or finance record reads | Pending | NOT RUN |
| Finance officer login | Can record and prepare; cannot verify payments or approve expenditure/reconciliation | Pending | NOT RUN |
| Finance manager login | Can independently verify payments; cannot approve principal-only decisions | Pending | NOT RUN |
| Principal review | Can independently approve eligible expenditure and reconciliation; self-review denied | Pending | NOT RUN |
| Revoked / expired finance role | Existing session immediately loses access on next PEOS authority check | Pending | NOT RUN |
| Second school isolation | No cross-school directory entries, learner lookup or finance record access | Pending | NOT RUN |
| PEOS unavailable / invalid response | All protected finance actions fail closed; no partial record created | Pending | NOT RUN |
| Teacher dashboard and account switching | Remain usable without finance; no private finance data persists after sign-out | Pending | NOT RUN |
| Migration and rollback rehearsal | Disposable production-shaped DB; restricted grants verified; restore procedure timed and reviewed | Pending | NOT RUN |

**Required execution order:** deploy isolated PEOS authority branch; apply PEOS migration and seed synthetic roles; deploy isolated SpaceCase branch; apply finance migration with restricted runtime; run the signed-in scenarios above; record failures and rerun after fixes; rehearse database restore; obtain independent review. Keep the finance feature flag off in production throughout. Do not treat a green CI build as approval to merge or enable real finance processing.
