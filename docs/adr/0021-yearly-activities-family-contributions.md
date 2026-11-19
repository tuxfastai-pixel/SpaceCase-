# Yearly activities and family contributions

Status: approved direction from user; first calculation/planning slice prepared. Connected operational rollout remains pending the dependencies below.

## Goal and current evidence

Connect school activities, school-approved contribution schedules, Flexi top-ups, payment evidence, independent Finance verification and family statements. Keep the experience short: Choose activities → Explore amounts → Review → Agree; later I have paid → Upload proof → Track review.

The existing planner is a teacher weekly-lesson planner, not a school annual-activity register. Finance has invoices, receipts, allocations, approvals and audit history. Family APIs currently support onboarding drafts, child photos and invitations; those are not authority to read a child's financial account. No parent finance endpoint or private payment-proof service was found in this repository. Existing finance API permissions apply to staff. No assumption that this feature is already connected, deployed or live.

## Domain ownership and records

SpaceCase owns school activity dates, audience and participation, proposals/approvals, cost estimates and financial links. Keep weekly lessons separate. PEOS remains canonical for identities, active school roles, guardian/learner relationships, billing access and notifications. No parallel identity directory or unconditional financial access for all guardians. PSG AI owns any future bounded evidence extraction; extraction never verifies payment.

Durable records required:
- School calendar policy: academic period, ordered term ranges and explicit half-year ranges; approved contribution options, minimums and event funding deadlines. School policy revisions do not silently alter accepted plans.
- Activity and version: school ID, title, event date, money-needed date, scope/audience, optionality, organiser, income/cost estimates, proposal and independent approvals, publication state. Approved published price versions are immutable; amendments are new versions.
- Participation and charge: authorized child plus explicit optional selection, activity version, quantity and invoice/charge ID. Consent to attend and financial-plan acceptance are separate records. Never create a second charge when regenerating a combined view.
- Family plan revision: one school/currency scope, eligible selected charges, proposed allocation preferences, schedule, agreement actor/time and policy/version snapshot. Never combine separate schools into a ledger account. Multiple children may be summarized only with explicit billing authority to each.
- Contribution intent/top-up: opaque idempotency key, exact minor units, target split and revised-schedule preview. Intent is not a payment. Re-acceptance is required to reduce instalments/change dates; paying early need not rewrite the original obligation.
- Evidence submission: submitting person, authorized school/charge scope, immutable private file/hash, claimed date/amount/reference/method, intended split, revision, status, decision and linked receipt ID. Evidence can be awaiting review, needs information, rejected, withdrawn or linked; payment verification derives from the existing receipt workflow.
- Statement snapshot: verified ledger revision, issue time, opening/closing figures, activity charges, verified allocations, credits/adjustments and separately labelled pending submissions. Read access/download issuance audited. It is an account statement, not proof of bank settlement or a tax invoice.

## Allocation and affordability

ZAR amounts are exact integer cents with bounded totals. Suggested priority uses money-needed dates, not event price or event date. Preserve explicit parent activity splits; the automatic remainder uses other activities. A suggested alternative may cover the earliest activity first but never silently overrides the selected split. Proportional allocation distributes every cent deterministically; no over-allocation. Any excess remains visibly unassigned until a school-approved credit/refund/donation process exists; do not implement an implicit wallet.

Equal instalments, school terms, every-two-month schedules, school-defined half-years and variable amounts must all use approved calendar dates. Check cumulative funding by each activity deadline, even when the annual total balances. Flexi contributions may be combined with a committed plan and may be irregular; activity deadlines remain visible. New top-ups are separate intentions until verified. Prevent re-use of the same receipt against the same invoice pairing under the existing rule; calculate charge-level splits before accepting, and resolve partial repeated top-ups without creating duplicate allocations.

Current calculation module provides estimates only and is not an authorization or settlement authority. The future server must reload the authoritative prices/verified balances, validate the selected school scope and re-run calculations. Never accept browser balances or verification fields.

## Roles and authorization gates

Administrator maintains calendar/activities and coordinates publication; assigned teacher proposes and manages own activities. Finance reviews amounts and manages charges, evidence, receipts and reconciliation. Principal/authorized independent approver approves within school policy; event approval does not approve every expense. Parents access only their specifically authorized billing scope; learner views omit account/evidence details. Founder access does not bypass school financial permissions.

Before any parent endpoint is enabled, PEOS must supply a versioned, deny-by-default family billing scope decision bound to current person, school, active child relationship, permitted action and expiry. Recheck on every read, file fetch, write and worker delivery; revocation stops future access. Client IDs/knowledge of a learner reference confer no rights. Staff evidence reads also require current school finance authority. Cross-school references fail closed.

## Upload and verification flow

Use private storage, opaque server-generated file IDs, size/type limits, content-signature validation, malware/quarantine gate, restricted expiring downloads and a documented retention/deletion policy. Never public Blob URLs, document references pretending to be uploads or onboarding photo endpoints repurposed for banking documents. Do not log file contents or bank details. OCR is optional: parent reviews extracted amount/date/reference before submission; no AI auto-verification.

Submitting proof creates a pending case and in-app acknowledgement, not a verified receipt/balance reduction. Staff queue includes pending, aged, approaching-deadline and mismatch/duplicate reasons. Routine cases are not all labelled urgent. Verify against independently held bank/provider records. Reusing the same proof/transaction must not duplicate receipts; ambiguous matches require review. An imported bank receipt linked to parent proof is one payment, not two.

Use existing receipt verification/independent reviewer boundary; the officer capturing a receipt cannot verify it. Review rejection, request for information and decisions retain history. Approval must lock/check current revision, atomically link the existing/new receipt and immutable evidence, and apply authorized allocations only once. A timeout requires status lookup by idempotency key before retry; never silently repeat a financial command.

After verification and allocation, generate the account statement from current ledger records. A statement can be generated automatically from verified entries under school policy; a pending document remains clearly labelled provisional. Rejected evidence does not erase the original submission or change settled balances. Cancellations/price changes use auditable credit/adjustment processes rather than overwriting charges.

## Notifications

Create durable notification events only after the corresponding transaction commits (outbox), with deduplication and retry. PEOS owns routing/delivery. In-app tracking is the baseline; email/SMS delivery remains disabled until provider and recipient preferences are verified. No sensitive documents in notification payloads; link to the signed-in account. No messages sent as part of implementation/testing. Parent notification states distinguish submission received, more information needed, rejected, payment confirmed and statement ready. Capture, verification and allocation may be separate states.

## Delivery and acceptance

ACT-PAY-01: exact calculation engine + staff planning preview (prepared here). Not persisted or a parent commitment. Local tests cover half-payment example, explicit splits, deadline priority, proportional rounding, excess funds, invalid values, unavailable schedule and early shortfalls. Preview navigation/keyboard/mobile acceptance separately required.
ACT-PAY-02: persistent school activity/calendar register and staff proposal/approval/publication; audience and existing invoice links, transaction/idempotency/concurrency tests.
ACT-PAY-03: PEOS family billing-scope contract, parent account view, optional participation and immutable plan acceptance/revision; real revocation/cross-family/cross-school tests before enabling.
ACT-PAY-04: private proof upload/quarantine, staff queue, deduplication and receipt linking; capture/independent verification and stale-review tests, secure-file access and deletion evidence.
ACT-PAY-05: statement snapshots and PEOS notification outbox/delivery; full synthetic activity → parent plan → proof → review → verification → allocation → statement walkthrough; provider/notification limits remain explicit.

Rollout stays isolated Preview until role, retention, private-storage and operational walkthrough gates pass. No Production changes in this work. Existing Finance-home visual acceptance remains pending; this work does not close it.

## ACT-PAY-02 initial staff implementation

Saved register is initially inside Finance behind SPACECASE_ACTIVITY_REGISTER_ENABLED (off by default). It uses existing finance.transactions.read/record and finance.policy.manage authority, rechecked by the service. Distinct administrator/teacher activity permissions are not inferred. Staff publication only makes a record selectable for calculator estimates; it does not send a parent notification, issue charges or imply schoolwide financial approval.

Calendars and activity/decision versions are append-only. Rejected and approved versions retain their original fields/reasons; edits are permitted only to the original preparer's draft/rejected activity. Approvals cannot be performed by its preparer even with Principal policy authority. Published records cannot be edited; cancellation preserves history, and a changed proposal must be separately created/reviewed. Calendar revisions do not rewrite existing activity references. Idempotency is scoped to account, request ID, actor and canonical validated payload; every retry still requires current permission. Account locking serializes request replay, calendar revision checks and competing reviews. No new broad database update privileges.

Before enabling outside isolated Preview: run migration and restricted-runtime lifecycle tests, inspect actual flag/configuration, verify staff role flows and phone/keyboard experience. Subsequent family billing and charge linkage work must enforce charge-level idempotency and retain the activity version chosen by the parent.
