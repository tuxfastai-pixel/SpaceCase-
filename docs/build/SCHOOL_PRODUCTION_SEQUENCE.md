# School production build sequence

This is an implementation plan, not a declaration that its features are live.

## Executive scope

Deliver a school pilot with verified organisational authority, separate leadership and operational permissions, family privacy, and traceable financial records. SpaceCase subscription billing is separate from each school's fee accounts. No role selection or school identifier grants authority. Provider integration, spending, binding school policy and verification evidence require explicit decisions when concrete.

## Engineering scope and ordered gates

1. School profile: PEOS owns EMIS/examination centre identifiers, address, location and general contacts. Current school administrator/principal authorization on each read/write. Revision conflicts preserve edits. Gate: migration/permissions verified, database integration tests, backend then frontend release, intended-user walkthrough.
2. Registration requests: principal or administrator can submit a pending school request. Duplicate candidates do not reveal another school's private data. Independently verify the nominated principal before creating school authority. Define evidence retention, reviewer eligibility, appeal/rejection, principal replacement and recovery before activation. Gate: forged, duplicate, replayed, withdrawn and unauthorized decisions deny access; no signup role grant.
3. Principal security: independently assigned principal authority; administrator cannot self-promote or remove the principal. Workspace switching changes presentation only. Add step-up verification for sensitive actions and a reviewed principal recovery process. Gate: revoked role immediately denied; direct URLs and API calls cannot bypass authority.
4. Principal workspace: operational summaries, outstanding approvals, financial summaries, access changes and audited activity. Restricted leadership records remain separate. Sensitive learner detail requires a purpose and current permission; no automatic broad founder/observer access.
5. Finance foundations: school-scoped finance officer/bursar permissions, periods, categories, opening balances, exact monetary arithmetic and audit history. Separate invoices/charges, recorded versus verified payments, receipts, credits/adjustments and refunds. Immutable history with explicit corrections; permissions and approval limits decided before execution.
6. Fees and parent accounts: grade fees, textbooks, stationery, uniforms, photo days, transport, fundraisers and levies; instalments, commitments, invoices, allocations, receipts, arrears and statements. Guardians see only independently authorized family accounts. Manual verified recording/reconciliation first; payment collection and debit orders remain separate integrations.
7. Budget and expenses: annual budget upload/capture, supporting documents, expense capture, principal approvals and budget-versus-actual reporting. Include electricity, water, maintenance, repairs, cleaning, security, transport and salary expenditure. Salary reporting is not full payroll.
8. Everyday workflows: finish learner/parent onboarding, attendance, assessment sources and teacher-reviewed marking. Keep automatic email, OCR/AI execution and family submission accurately labelled until independently verified.
9. Support/founder operations: scoped issue handling, audit, observer queues and actual reliability signals. School finance records and learner detail are not exposed by default. Subscription enforcement follows accepted terms and a separately verified release.
10. Pilot readiness: full role journeys, physical-phone checks, backup restore test, incident recovery, onboarding examples, support ownership and documented limits. No percentage claim without an evidence-based acceptance checklist.

## Execution and release discipline

Each stage records code/CI status, migration state, deployed commit, live evidence and remaining dependencies in FEATURE_COMPLETION_REGISTER.md. CI includes isolated PostgreSQL fixtures; no synthetic production identities. A passing mock/unit suite does not establish live completion. Routine implementation proceeds under the approved sequence; no new provider subscriptions or financial commitments are implied.
