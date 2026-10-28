# School finance ledger: first durable slice

## Executive scope

Give current principals and explicitly delegated finance officers a private school ledger. This is separate from the school's SpaceCase subscription account. No fee tariff is selected, no money is collected, no parent is notified and no bank/debit mandate or tax invoice service is enabled. Parent account access, payment agreements/signatures, budgets and operating expenses remain later slices.

## Engineering boundaries

PEOS owns current school staff roles, principal-controlled finance invitations and revocation, and finance-purpose learner lookup. SpaceCase owns financial account references, invoice/payment records, allocations and audit events. Learner identity is referenced by canonical person ID; only the school reference at account creation is retained as a historical financial snapshot. No learner marks, medical details or family narratives are collected.

A principal or current school finance officer may prepare a learner account, invoice draft and payment report. Issuing an invoice requires a different current principal. A reported payment is not money received or bank settlement: only a different current principal can mark it school-verified after checking school records. Rejection is principal-controlled. Staff can allocate an already verified payment only to an issued, undisputed invoice for the same school/account. Unsupported browser authority, balance and verification fields are rejected.

Amounts are ZAR integer cents. Invoice/payment amounts are immutable for the application runtime. Drafts can be voided and issued invoices disputed/resolved with reasons; paid invoices cannot be voided. Incorrect reports are rejected and corrected through a new record. Reversals/refunds and period closing are not available yet. One principal without another preparation/approval participant cannot self-approve; there is no emergency bypass.

`school_finance` is private. Row policies use a transaction-local school scope set only after fresh canonical authorization. The restricted runtime has no DELETE and cannot update invoice lines/amounts or payment amounts/references. Events and allocations are append-only. Multi-column foreign keys prevent account/invoice/payment scope mismatch. Request keys and advisory locks prevent replay and duplicate references. Payment then invoice row locks serialize competing allocations; balance reads occur after locks under READ COMMITTED. Ledger reads use a repeatable snapshot, including totals beyond the bounded displayed history.

No founder, observer, plain administrator, parent or teacher inherits finance access. A principal may delegate a separate finance role using an email-bound staff invitation and revoke that role without removing unrelated staff roles. Revocation is checked afresh on the next request. No role is granted merely by schema deployment.

## Execution and acceptance

1. Verify PEOS role migration, finance delegation/context and denial/revocation tests.
2. Verify migration0019 in isolated PostgreSQL and an isolated Neon branch; inspect runtime privileges/RLS/checksum without reading existing school records.
3. Run ledger concurrency, idempotency, independent-approval, tenant-scope, immutable-column and audit-rollback tests.
4. Add a compact finance workspace with account lookup, draft/report forms, principal approval explanations and clear school-verified labels.
5. Release schema, PEOS, then SpaceCase; verify readiness and intended-account/phone flows. Keep incomplete functions in FEATURE_COMPLETION_REGISTER.md.

No production change is implied by this document or by a passing mock test.
