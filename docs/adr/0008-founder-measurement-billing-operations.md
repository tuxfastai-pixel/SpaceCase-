# ADR 0008: measured operations and school billing preparation
Status: accepted for implementation; billing enforcement and staff provisioning are not activated.

## Boundaries and failure analysis
PEOS owns canonical identities, staff authority, school membership and eventual subscription entitlements. SpaceCase stores product invoice reconciliation and operational measurements. No competing identity store is introduced.
No school is marked delinquent merely because an invoice/payment is absent. No screenshots, ticket narratives, learner identifiers, free text or individual teacher rankings enter aggregate founder insights.
Payment callbacks and proof-of-payment files are not treated as settlement. This release records independently verified receipts manually through founder-only mutations. No gateway, bank account data, invoice delivery, tax invoice generation or collection is connected.
Invoices use integer ZAR cents. An invoice can be paid in parts. Overpayments are rejected; credits/refunds require a later accounting workflow. Invoice amounts are immutable; incorrect invoices can be voided after recorded receipts are reversed. Receipt reversals preserve the original record and write an audit event.
Duplicate invoice/payment references are rejected, request IDs are idempotent, invoice row locks serialize balance changes. A dispute is separate from payment status. Overdue uses the South African calendar date; due today is not overdue.
Ledger details are founder-only or restricted to a freshly authorized canonical school administrator. General school staff context is never enough. Runtime has no delete, schema-create or permission to alter monetary values.

## Measurements delivered
Founder-only snapshot: active and incomplete product workspaces, schools/registers whose latest attendance update was in the past 30 days, support submission volume for current/previous 30 days, current backlog, blocked/urgent requests and requests older than 48 hours, median first technical update with answered/total coverage.
Latest register update is not an event history and must never be called a complete usage funnel. Invitation conversion, abandonment, active people, retention, attendance completeness, uptime and cost remain explicitly unmeasured.
Cross-school area/category groups require >=5 schools, exclude narratives, are capped at ten groups and are hypotheses rather than causal findings. No AI model is called. Operational support access remains separate from anonymous analytics.
All queries run in a consistent transaction with an eight-second insights statement timeout. Relevant time and ticket-response indexes are added. This is pilot implementation, not evidence of 15,000-school load readiness.

## Scale path
Before large rollout: load test representative concurrent school-day bursts, pool saturation, p95/p99 latency, queue backlog and noisy-neighbour limits. Move metrics to bounded daily rollups/read replicas where measured load warrants it; do not scan event history on every page refresh. Use deduplicated queued jobs and webhook idempotency for delivery/payment integrations. Retain pagination and indexed tenant filters.
Configure aggregate retention separately from statutory/accounting retention; never delete mandatory audit/accounting records as an analytics cleanup shortcut.

## Staffing and governance
The operations desk is a human workflow supported by automation, not a traffic proxy. Proposed roles:
- Support observer: assigned queue metadata, acknowledgement and escalation; no learner records, billing amounts or deployments.
- Onboarding specialist: assigned schools' configuration progress; no global learner search.
- Reliability monitor: aggregate service health, incident timeline and safe runbooks; no unrestricted database access.
- Billing reconciler: invoice/receipt verification within an assigned portfolio; no suspension authority.
- Operations lead: queue assignment, quality review, escalation and shift handover.
- Engineer: approved technical investigation in isolated environments; no default production data export.
- Founder: policy and prepared-change decisions.
These roles are specifications, not live access grants. Implement canonical PEOS roles, scoped assignment, audit and negative authorization tests before inviting staff. Start with cross-trained staff during supported hours, hire as queue volume and service targets justify it.
Estimate staffing from observed daily cases * handling minutes / productive minutes per agent; adjust for peaks, leave, languages, escalation, supervision and coverage. No staffing ratio is inferred just from school count.
No staff member receives founder privileges to work around missing operations roles.

## Staged delivery
1. Measurement foundation: this release reuses structured product records; explicit success metrics and gaps. Next: minimal server-side success/failure events, deduplication, retention, data notices and onboarding milestones.
2. Briefing: this release provides on-demand measured snapshot. Next: bounded daily rollups, trend coverage, reliability telemetry and scheduled weekly in-app summaries.
3. Opportunities: this release provides thresholded area/category evidence groups. Next: reviewed themes, experiment registry, outcome comparisons and uncertainty; do not treat feedback volume as representative demand.
4. Experiments/networks: not activated. Require founder-approved hypothesis, success/guardrail metric, eligible cohort, time window and rollback. Any partner introduction is opt-in and excludes learner data.
Automation must not execute suggestions, messages, charges, suspension or deploys merely because an aggregate threshold is met.

## Billing policy and activation gates
Show billing explanations from school administration and paid onboarding before acceptance, and retain a versioned agreement accepted by an authorized signatory, contract version/hash, time, school and agreed plan. Role assignment alone is not proof of contracting authority.
A later paid activation flow must include actual price/taxes, term, due date, grace period, notices, dispute route, permitted restrictions, data retention/export and recovery timing. Any reconnection fee must be specifically agreed, disclosed and reviewed for proportionality/legal applicability.
Proposed flow: invoice -> reminder -> overdue -> written notice and cure period -> human review -> limited restriction -> verified settlement -> restoration. Preserve sign-in, billing, support and appropriate data access/export. Do not erase or hold learner records hostage. Disputed amounts and payment reconciliation delays must stop automated adverse decisions.
No grace period, tariff, penalty, jurisdiction applicability or accepted contract has been invented in this release. Suspension and reconnection fees remain disabled. Applicable South African requirements vary by contracting school and transaction; legal review must precede enforcement.
Primary references: https://www.gov.za/sites/default/files/gcis_document/201409/321864670.pdf (CPA ss14,48) and https://www.justice.gov.za/legislation/acts/2013-004.pdf (POPIA minimality and safeguards).

## Validation and release
CI: contracts, role denial, reconciliation idempotency, concurrent balance enforcement, immutable corrections, privacy and full build. Test migration and restricted runtime privileges on an isolated Neon branch. Production migration requires the explicit confirmation requested by the Neon migration completion tool; do not merge/release code depending on unapplied tables. Signed-in browser verification remains outstanding while no browser environment is available.
