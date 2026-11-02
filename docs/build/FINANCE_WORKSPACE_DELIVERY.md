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
