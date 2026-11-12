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

**Preview exercise rule:** After proving disposable database isolation, applying migrations/restricted grants, verifying synthetic role assignments and recording the reviewed source pair/CI, enable `SPACECASE_FINANCE_WORKSPACE_ENABLED=true` only in that isolated Finance preview so the functional walkthrough can run. Set its workspace mode to `operational`; `authority_only` deliberately blocks Finance. Complete the signed-in scenarios before calling that preview Finance-ready. Keep the existing authority-only pilot unchanged until a separately reviewed Finance environment is available, and keep Production Finance off. Principal step-up/recovery, evidence retention and human sign-off remain mandatory production gates.


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

## Integration review and walkthrough preparation — 12 November 2026

Reviewed source pair: SpaceCase Finance workspace through `1bd0ccb29848cfd73c2c934ee56b2ae305f80cc7` and PEOS authority PR37 head `eec230d1aaddfd949ad08f4b2bfce101aac309cb`. PEOS CI `42190688891` passed for that head. This is source/contract evidence, not proof that either head is deployed together or that an intended-user walkthrough passed.

A preview transport gap was found: the Finance directory page and admin proxy forwarded the platform's preview deployment identity, but Finance permission checks and exact learner lookup did not. The continuation aligns those adapter requests with the existing preview pattern. The user bearer remains the PEOS application identity; deployment identity only permits access through Vercel protection and never grants a Finance role. Production/development do not forward the preview token. Wrong school/action, negative decisions, missing session and PEOS/protection failures continue to deny access. Protected cross-project previews still require the existing permitted Trusted Sources relationship; this change does not alter platform access rules.

### Role acceptance matrix

These are current PEOS policy expectations, enforced again server-side on each request, not permissions granted by a role toggle.

| Action | Principal | Finance manager | Finance officer | Administrator / teacher / parent / founder alone |
| --- | --- | --- | --- | --- |
| Finance directory / transaction reads | Allow | Allow | Allow | Deny |
| Prepare invoices, reported payments, budgets, expenses and reconciliation | Only with a separate active Finance assignment | Allow | Allow | Deny |
| Independent payment verification | Allow | Allow | Deny | Deny |
| Independent expenditure / reconciliation approval | Allow | Deny | Deny | Deny |
| Summary | Allow | Allow | Deny | Deny |
| Audit history / CSV | Allow | Deny | Deny | Deny |
| Account policy / Finance invitations / role termination | Allow | Deny | Deny | Deny |

If a person holds multiple permitted roles, preparation still prevents that same person from verifying/approving their own record. A Finance manager's payment-verification permission does not authorize expenditure or reconciliation approval.

### Synthetic signed-in exercise

Use separate synthetic accounts for principal, officer, manager, ordinary administrator/teacher, and a second-school principal. Record account labels only, never credentials/tokens. Before starting, prove the actual preview's database isolation and record both deployed SHAs plus migration state. A READY deployment alone is insufficient. SpaceCase pilot metadata currently reports a READY preview of `1bd0ccb`; isolation, effective feature flags and the connected PEOS head have not been verified in this review.

1. Principal opens Finance, initializes the already-provisioned school account, and checks the empty view. Ordinary administrator and teacher try the same path and direct API; both must be denied.
2. Principal creates manual officer/manager invitations; the intended identity accepts. Wrong-email acceptance and issuer demotion must fail. These links are sent manually by the tester; automatic delivery remains off.
3. Officer records a synthetic R100.01 invoice in R50.01/R50.00 instalments, reports a payment, prepares a R100 budget. Principal independently approves that budget with a reason; officer then submits a R70 expense with a synthetic evidence reference. Officer cannot verify or approve. Manager independently verifies the payment; officer allocates it.
4. Principal checks the evidence reference and approves the expense with a reason. Review the same record as its preparer using a synthetic dual-role account: the server must deny self-approval. Submit a second R70 expense against the R100 budget: approval must fail because only R30 remains.
5. Officer submits reconciliation; principal reviews it. Change the period ledger after submission and verify stale approval fails; reject, revise and resubmit with retained history.
6. Principal searches audit history and exports a page. Manager/officer/administrator direct audit JSON and CSV requests must fail. Search a period with more than 100 synthetic events and confirm older/newer navigation and clear page export limits.
7. Principal ends a Finance role; leave that person's session open and retry reads and writes. The next authority check must deny access. End the officer's membership or expire its role, then repeat. Test a second-school account/record identifier and PEOS outage without any partial ledger write.
8. Repeat at desktop and phone widths: switch accounts, sign out, refresh and use browser back. Financial data must not remain visible under another identity. Record screenshots without personal information and log each expected/actual result in the evidence table above.

Known follow-up: the current team list retains historical invitation acceptance after accepted-role termination; it does not yet expose a current role-assignment status. Do not interpret “Accepted” as active Finance authority. Verify effective access using fresh PEOS checks; explicit active/ended team status remains UI work. Principal verification/step-up/recovery and approved evidence retention remain production gates.


Read-only preview configuration observation — 12 November 2026: `spacecase-pilot` project-level preview configuration has `SPACECASE_WORKSPACE_MODE=authority_only`; no `SPACECASE_FINANCE_WORKSPACE_ENABLED` entry is listed. That mode blocks Finance API access regardless of a READY build. No project-level PEOS/database entries were listed; inherited/shared resource configuration was not independently verified, so no database isolation conclusion is claimed. The next deployment gate is a separately isolated Finance test environment with reviewed PEOS/SpaceCase heads, restricted database migrations and synthetic identities, followed by controlled preview-only activation and the walkthrough above. No configuration was changed by this review.

## Dedicated synthetic Finance test resources — 12 November 2026

- Vercel: `spacecase-finance-test` (`prj_H20d8jYzF5zN80bAuARJUA5i8uKR`) and `peos-finance-test` (`prj_pOSAxbOrZATecuUUN9aHymvsd5VK`), both with all-deployment Vercel Authentication.
- Data: new empty databases in the existing separate Finance preview Neon projects; no Production data or existing preview identities copied. SpaceCase migration count 20; PEOS count 10. Runtime credentials are restricted and saved only as Preview secrets.
- PEOS source: `eec230d1aaddfd949ad08f4b2bfce101aac309cb`. SpaceCase source is pinned per test deployment/evidence. Five short-lived synthetic PEOS sessions are for engineering checks only; there is no new login bypass or public test-account selector.
- Vercel's cross-project Trusted Sources update returned 404. Use the supported test-project automation credential through the optional server-only `PEOS_PREVIEW_PROTECTION_BYPASS` fallback, evaluated only in Preview. Keep Vercel Authentication and all application permission checks. Revoke it when test verification is finished or the environment is retired.
- Existing pilot and product Production configuration remain unchanged. Initial deployments in newly created projects are automatically labelled Production by Vercel; they had no Production environment credentials. Run actual tests only against explicit staging/Preview deployments.
- Google sign-in remains a separate gate: this test pair does not yet have a verified isolated Supabase/OIDC issuer, callback allowlist and synthetic credential mappings. Synthetic-session API verification does not establish real Google login, invitation/email delivery or physical-phone acceptance.
