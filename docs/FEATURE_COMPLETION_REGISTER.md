# Feature completion and activation register

Updated: 26 October 2026 (Africa/Johannesburg).

Purpose: keep disabled functions, unfinished work and verification gaps visible until the system is finalized. This is the current engineering register for SpaceCase and its PEOS/PSG/Atlas dependencies. Historical sprint notes describe their release at the time; they are not proof of current production configuration. This register is a source/release audit, not a fresh signed-in audit of every production capability. No feature is enabled by this document.

Pilot preparation estimate: approximately **70% for a small supervised teacher/admin pilot**, not general launch readiness. See [the scope, weighted planning rubric and mandatory gates](PILOT_READINESS.md). This is an engineering estimate; the in-app /pilot checklist records separate self-reported observations.

## Status and completion stages

- **OFF**: intentionally not executing in the current implementation/release evidence.
- **PREPARED**: code exists in an open PR or an unconnected integration; not a live feature.
- **PARTIAL**: useful subset exists; additional work is required.
- **VERIFY**: implementation/release evidence exists, but current configuration or an end-to-end scenario needs checking. This does not mean disabled.
- **PLANNED**: no complete operational implementation is established by the audited sources.
- **PROTECTION**: deliberate product/privacy rule, not a missing feature to switch on.

Stages are dependency gates, not promised dates:

| Stage | Finalize when | Exit evidence |
| --- | --- | --- |
| A — Pilot completion | Core teacher/admin/parent workflows are ready to exercise | Signed-in role walkthroughs, real-phone checks, current authorization/revocation tests and clear error recovery |
| B — Delivery and family access | Verified sender and governed school-family contracts are ready | Durable dispatch/event records, scope isolation, consent and revocation tests, controlled live recipient checks |
| C — AI and engineering automation | Approved provider policy, budgets and bounded execution are ready | Synthetic quality evaluation, secure integration test, human review and explicit deployment controls |
| D — Paid operation | Commercial terms and accounting/payment processes are ready | Reviewed terms, versioned acceptance, reconciliation, notices, dispute/restoration tests |
| E — Wider rollout | Pilot measurements justify expansion | Restore drill, incident runbooks, retention proof and representative concurrent-load evidence |

Owners below are service/domain responsibilities, not access grants or assigned employees. Technical work can proceed without purchasing services; activation dependencies are recorded explicitly.

## Disabled and prepared functions

| ID | Function / status | What remains and dependency | Owner / stage | Completion evidence / source |
| --- | --- | --- | --- | --- |
| MSG-01 | Automatic staff, bulk and family invitation email — **OFF** | Verified sender/provider configuration; explicit authorized send action; encrypted durable outbox; rate/budget limits; invitation revalidation; leased attempts; cancellation; signed event handling; school-scoped delivery UI | PEOS notifications + SpaceCase UI / B | Revoked/rotated/expired jobs do not dispatch; crashes/duplicates do not duplicate sends; controlled real-recipient delivery check. PEOS `domains/notifications/invitationDelivery.ts`, [manual delivery ADR](adr/0002-manual-invitation-delivery.md) |
| MSG-02 | Resend adapter and bounded retry policy — **PREPARED** | PEOS PR16 is open, not deployed; connect only through MSG-01's reviewed dispatcher. Fixed failure results are not persistent delivery history | PEOS / B | [PR16](https://github.com/tuxfastai-pixel/PEOS/pull/16), head `3f9feb111b74b30670e0e0da02aad4d1503fd17e`; CI `40269242424` passed. Preparation plan: PEOS `docs/notifications/INVITATION_EMAIL_PREPARATION.md` |
| MSG-03 | Automatic homework, attendance, support and school-family notifications — **OFF / PARTIAL** | Shared delivery infrastructure plus per-event preferences, correct recipients, bounded templates, deduplication and delivery failures. Teacher-reviewed evaluative messages require approval before sending | SpaceCase + PEOS / B | No implicit sending from assigning homework, opening a draft or recording a ticket. `app/homework/HomeworkClient.tsx`, [communication acceptance](sprints/007-communication-acceptance.md) |
| FAM-01 | Submit private family draft to school — **OFF** | Explicit review/consent; canonical child matching through PEOS; revision-bound submission; school review/corrections; required child photo on actual submission; separate treatment of optional medical information | SpaceCase intake + PEOS identity / B | No draft/photo/address/medical transfer merely from sign-in or invitation acceptance. [Readiness](sprints/050-family-verification-readiness.md), [photos](sprints/049-family-profile-photos.md) |
| FAM-02 | Parent reports, attendance, homework and child correspondence workspace — **PLANNED / PARTIAL** | Current purpose-scoped school/learner access contract after contact confirmation; record projections and correction/communication flows; live revocation checks | SpaceCase + PEOS / B | Cross-school/wrong-child denial; withdrawn/revoked contact cannot retain access. `app/help/ParentHelp.tsx`, `app/family/connections/Connections.tsx` |
| FAM-03 | Child photo as shared correspondence avatar — **PARTIAL** | Private draft photo exists; establish approved canonical profile association and recipient-scoped image serving before using it in messages | SpaceCase + PEOS / B | Authorized correspondence can show the right approved photo; URLs remain private; removal/retention verified. [Photos](sprints/049-family-profile-photos.md) |
| AI-01 | Photo OCR/vision reading and proposed marking — **OFF by recorded release policy; live configuration VERIFY** | Approved PSG service/model/retention policy; server credentials; explicit execution switches and bounded caps; current assignment/page matching; synthetic accuracy and uncertainty evaluation | PSG AI + SpaceCase / C | Manual marking remains usable; unreadable pages stay uncertain; no automatic final grades. `platform/assessment/ai.ts`, [vision](sprints/021-vision-reading.md) |
| AI-02 | General SpaceCase Teacher Assistant and specialist teaching assistance — **PLANNED / PARTIAL foundations** | Teacher-scoped tools, approved PSG runtime, budgets, evaluated output, reviewable planning/resource/communication assistance | PSG AI + SpaceCase / C | Demonstrate each permitted action and denial; no invented learner facts or unapproved model transmission. `app/dashboard/DashboardClient.tsx`, project constitution |
| ENG-01 | Agent team, automated diagnosis/self-healing, repository changes and execution — **OFF / not connected** | Bounded runner, explicit task authority, isolated workspace, reviewable patches, evidence, costs, retries/cancellation and rollback. Ticket submission/acknowledgement is not automatic engineering execution | PSG engineering + SpaceCase founder / C | Synthetic ticket-to-patch workflow with human decision; no production changes from a ticket or approval record alone. `EngineeringHandoffPanel.tsx`, [handoff](sprints/025-engineering-handoff.md) |
| ENG-02 | Automatic merge/deployment after founder approval — **OFF** | Separately governed release workflow with exact commit, current checks, scoped authority and rollback; no automatic linkage from approval storage | PSG engineering / C | Approval does not itself execute. [Trusted approval](sprints/040-trusted-evidence-approval.md) |
| ATL-01 | Atlas accelerated onboarding and ongoing school integration — **OFF / integration foundations** | Real versioned PEOS consent/grant/entitlement contract, Atlas endpoint and explicit allowed scopes; import review; revocation handling | Atlas + PEOS + SpaceCase / B/C | Test no-consent/no-entitlement denial and immediate stop on revocation; no unrestricted Atlas history import. [Atlas onboarding](sprints/010-atlas-onboarding.md) |
| BILL-01 | Payment collection, automatic settlement and tax invoice issuance — **OFF** | Chosen payment/accounting integration; verified callbacks and reconciliation; price/tax decisions; refunds/credits and audit workflows | SpaceCase billing + PEOS entitlements / D | Duplicate callbacks do not double-record; unverified proof is not settlement. [Billing ADR](adr/0008-founder-measurement-billing-operations.md) |
| BILL-02 | Non-payment suspension, penalty and reconnection fee — **OFF** | Reviewed contract/policy, authorized versioned acceptance, due/grace/notice/dispute rules, human review, permitted restrictions and restoration. No tariff or grace period has been selected | Founder commercial policy + engineering / D | Disputes/reconciliation delays stop adverse automation; essential sign-in/support/data access is preserved as agreed. [Billing ADR](adr/0008-founder-measurement-billing-operations.md) |
| OPS-01 | AI pattern investigation, automatic experiments and external network introductions — **OFF / PLANNED** | Better coverage/rollups, reviewed hypotheses, success/guardrail metrics, opt-in networks and permitted data scopes | Founder operations + PSG AI / C/E | Existing rule-based groups remain hypotheses; no automatic introductions or learner-level exports. `app/founder/InsightsPanel.tsx` |
| OPS-02 | Measured uptime/service health, school contact/location enrichment — **PARTIAL / not configured in founder view** | Instrument actual health sources and define provenance/access for operational directory fields | SpaceCase operations / A/E | Unknown values remain unknown rather than fabricated metrics. `app/founder/FounderClient.tsx` |

## Work requiring completion or verification

| ID | Function / status | Next action and dependency | Stage / evidence required |
| --- | --- | --- | --- |
| QA-01 | Family invitation → Google sign-in → acceptance → independent school review → history → withdrawal — **VERIFY** | Exercise two authorized administrators and intended parent, wrong email, expiry and revocation against the deployed services; do not create synthetic production identities | A/B. PEOS PR15 and SpaceCase PR55 deployed; CI and synthetic walkthrough passed. Signed-in production completion remains unverified |
| QA-02 | Final production history-page browser walkthrough — **VERIFY** | Resume browser check when tooling permits; prior final reload was not executed because automatic approval review hit a usage limit | A. Deployment readiness/health passed; do not equate that with signed-in UI verification |
| QA-03 | Phone camera, bulk photo selection, learner matching and marking review — **VERIFY ongoing** | Test current release on representative real phones, permissions, interrupted uploads, retries and long class lists | A. Camera/file UI implementation exists; desktop fixtures cannot prove physical-device behavior. [Capture](sprints/042-camera-page-capture.md), [scan shortcut](sprints/043-teacher-scan-shortcut.md) |
| QA-04 | Assessment file storage and retention — **CONDITIONAL / VERIFY** | Confirm configured private storage, current grants and retention/delete jobs; attachment upload is intentionally unavailable without authorized open assessment/storage | A/E. `docs/sprints/020-bulk-assessment-marking.md`, `043-teacher-scan-shortcut.md`; capture upload success/failure and private access evidence |
| QA-05 | Parent photo/medical draft review, clearing and single-caregiver onboarding — **VERIFY** | Signed-in owner isolation, required-photo readiness, optional medical note, clearing/removing a child and stale-revision recovery | A. Draft/photo/medical builds released; do not infer live owner isolation from mocks alone. Sprints 048–051 |
| QA-06 | Teacher attendance, planner, homework, observation and report flows — **VERIFY release regression** | Keep role-based live acceptance records for save/reload/corrections and revoked/ended assignments | A. These are implemented tools, not blanket disabled features; physical-phone report printing remains to verify. Sprints 013, 019, 022–024 |
| ENG-03 | Founder task storage, retention/purge and managed read-only GitHub proof connection — **VERIFY current operation** | Recheck current production service/link/configuration and record a signed-in task/evidence lifecycle, expiry/purge and independent reviewer checks | A/C. Previously approved/configured components must not be called disabled from older sprint notes. Sprints 028–041; `services/psg-ai/README.md` |
| ENG-04 | Evidence-dependent founder approval — **CONDITIONAL, not globally disabled** | Reproduce trusted current-head tests, artifact hashes, reproduction/rollback attestations, authorized independent human review and resolved threads | C. Missing/stale proof must block approval. A successful CI run alone is insufficient; recorded approval still grants no execution |
| OPS-03 | Operations observers/support agents — **PARTIAL / VERIFY staffing readiness** | Current school-scoped roles/access exist; complete staff onboarding, expiry/revocation checks, shift handover, escalation ownership and workload measurement | A/E. Do not grant founder access as a shortcut. `ObserverManager.tsx`, [support casework](sprints/018-support-casework.md) |
| OPS-04 | Founder metrics completeness — **PARTIAL** | Instrument minimally necessary success/failure/onboarding events with retention/notices, daily rollups and coverage labels | E. Invitation funnel, retention, uptime and cost are not established by current aggregate snapshots. [Billing/measurement ADR](adr/0008-founder-measurement-billing-operations.md) |
| SCALE-01 | Child photo storage beyond pilot — **PARTIAL** | Measure database/backup/egress costs; replace bounded database thumbnails with private object storage and transactional deletion/retention when warranted | E. Existing 100 KiB/256px thumbnails are a pilot design; no claim of large-scale media readiness. Sprint 049 |
| SCALE-02 | 10,000–15,000-school capacity — **UNVERIFIED** | Representative concurrent school-day load, tenant isolation/noisy-neighbour limits, pool saturation, p95/p99, queues, rollups and costs | E. School count alone is not performance evidence; choose upgrades from measurements |
| SCALE-03 | Production recovery and operations — **VERIFY** | Record backup/restore drill, service rollback, incident ownership/runbooks, alerting, retention backlog and deletion recovery boundaries | E. Provider backups and a ready endpoint alone do not prove recovery. No destructive drill in production |
| REL-01 | Release/configuration inventory — **VERIFY at each release** | Record companion service commit/deployment, applied migrations, runtime grants, feature flags and rollback evidence without secret values | A–E. Repository defaults and old notes cannot establish current production activation |

## Planned teacher/product completion

These are roadmap items, not promises that complete tools already exist. Existing attendance, weekly planning, homework tracking, observations, assessments/manual marking and progress summaries should remain available while these are added.

| ID | Remaining capability | Finalization requirement / stage | Current source |
| --- | --- | --- | --- |
| TOOL-01 | Official term reports | School-approved reporting format, term/subject aggregation, authorized sign-off, corrections and print/mobile checks / A/B | Dashboard roadmap; sprint 024 progress reports are not a complete official term-report workflow |
| TOOL-02 | Reviewed family communication | Recipient authorization, draft/edit/teacher approval/send and delivery history / B | Constitution and communication foundations |
| TOOL-03 | Teaching resource library and sharing | Ownership/licensing, private storage, scoped sharing/search and retention / A/C | Dashboard roadmap and constitution |
| TOOL-04 | Workload, professional development and wellbeing tools | Defined useful workflows, voluntary/private boundaries and completion evidence / later pilot priorities | Constitution lists domains; full operational tools not established in this audit |
| TOOL-05 | Wider learner/intervention/behaviour and school analytics workflows | Audit existing foundations, agree remaining acceptance criteria and implement without clinical inference or Atlas data merging / A/C | Constitution and earlier learner/intervention closeouts; do not classify all existing foundations as absent |

## Pilot handover

PILOT-01 — **IMPLEMENTED / release verification pending**: /pilot role guide, 18 acceptance checks, transient results and minimized download, scoped issue-title prefill, and entry links from teacher/founder/admin/parent help. No launch authority or persistent evidence store. Sprint 054; current release/live/device verification remains QA-01–06. The estimate above has not been increased for this guide.

## Protections that must not be treated as activation backlog

| ID | Protection | Future extension boundary |
| --- | --- | --- |
| SAFE-01 | Founder dashboard does not expose every learner's personal data | Any exceptional support view needs purpose, narrow current scope, duration and audit; no default global child access |
| SAFE-02 | No automatic final grades or evaluative messages in a teacher's name | Teacher checks, edits and approves outcomes/messages |
| SAFE-03 | Google sign-in, draft completeness, photos and contact confirmation do not prove legal guardianship or grant learner-record access | Separate current authorization and purpose-specific consent; no face recognition as proof |
| SAFE-04 | Preview environments do not execute production AI/engineering jobs or use production data by default | Use synthetic fixtures and explicitly isolated integration environments |
| SAFE-05 | A saved founder recommendation/approval is not permission to run an agent or deploy | Separate bounded execution and release authority |
| SAFE-06 | No silent school/Atlas/AI sharing of photos, medical notes or family narratives | Explicit consent and minimum versioned scopes; subscription is not consent |

## Configuration references (names only)

Do not turn on these switches to make an incomplete feature appear available. Do not store their values or secrets here.

- `SPACECASE_FAMILY_INVITATIONS_ENABLED`: recorded production activation completed with PR54; PR55 adds history/withdrawal. Defaults off in code. Live acceptance is QA-01.
- `SPACECASE_ASSESSMENT_AI_ENABLED`, `SPACECASE_ASSESSMENT_AI_DAILY_LIMIT`, `PSG_AI_EXECUTION_ENABLED`: AI-01; live execution requires both services' policy/budget gates. Current configuration must be verified before any activation claim.
- `SPACECASE_ENGINEERING_LEDGER_ENABLED`, `PSG_ENGINEERING_LEDGER_ENABLED`: storage-only gates, not agent execution. Treat as ENG-03 verification rather than assuming they are off.
- Managed GitHub connection settings: ENG-03/04; read-only proof verification is distinct from repository write permission.
- `SPACECASE_WORKSPACE_MODE`: `authority_only` restricts operational routes; this is an intentional mode, not a normal missing-feature state. Verify the intended environment before changing it.
- Invitation sending has no live activation flag in the current implementation. Adding an API key alone does not enable it.

## Maintenance and closeout

Every feature/build PR must update affected IDs here, add newly discovered blockers and retain completion evidence. A status change should state: code PR/commit, migration/configuration state, tests, actual deployment and live scenario result. Use “not checked” when evidence is missing. Move released items to the milestone log instead of silently deleting their history. An item can remain VERIFY even after deployment if its role/device/integration check is outstanding.

Before each stage exit, review all rows for that stage and the protections. Separate work engineering can complete autonomously from decisions/configuration needed from the founder (sender/domain, provider budget/model policy, commercial terms). This register does not require repeatedly asking for approvals already granted.

### Release milestones already established

| Milestone | Established evidence | Outstanding |
| --- | --- | --- |
| Family drafts, photos, readiness and optional short medical note | SpaceCase sprints 048–051 released | QA-05; FAM-01–03 |
| School family invitations and contact review | PEOS PR14; SpaceCase PR54; flag activated in production | QA-01; no automatic learner-record permission |
| Parent connection history, withdrawal and review filters | PEOS PR15 merge `c7f315b09173edacdeebdc6cf16a6f99ef3cc6bb`; SpaceCase PR55 merge `e9937596fe2d7b222b3d4b42f6331b92f6ac3555`; both CI/deployments passed readiness checks | QA-01/02 |
| Email transport/retry preparation | PEOS PR16, final-head CI passed | Open/unmerged; MSG-01/02 remain inactive |

Pilot feedback limitation: parent-only accounts currently cannot submit school support tickets (staff authority required). Coordinate through the school pilot lead; a governed account-level parent support flow remains follow-on work (MSG-03 / FAM-02).

## Role workspace correction — 26 October 2026

ROLE-01 — **IMPLEMENTED / release verification pending**: current canonical founder/principal/admin landing precedence, fail-closed role lookup, neutral fallback labels, principal overview and principal/admin switch with school preserved. Sprint 055; verify actual-account home routing and ended/revoked role behavior after release. Existing pilot role repair was scoped and audited; no email allowlist.

ROLE-02 — **IMPLEMENTED / live verification pending**: account switching clears the previous local PEOS cookie before OAuth on success/failure; accessible from workspace headers. Confirm intended Google account selection and callback/error recovery. No session activity history was read. These items extend QA-01/06 and REL-01; the 70% pilot estimate is unchanged pending live evidence.

ROLE-01 release evidence: SpaceCase PR58 and PEOS PR17 deployed; both CI suites and live health/readiness passed. Synthetic browser validated school-preserving switching in both directions and absence of the principal selector for admin-only scope. Production /principal redirects an unsigned-in user to sign-in. Actual-account sign-in remains pending. Follow-up role-specific browser page titles replace the inherited Teacher OS label; no permission changes.

## New user and parent entry — 26 October 2026

ENTRY-01 — **IMPLEMENTED / release verification pending**: sign-in journey choices with fixed destinations and short-lived HttpOnly OAuth intent; /parent owner-only workspace entry; teacher/school invitation guides; unassigned dashboard choices. No school/guardian permissions from selection. Sprint 056. First actual parent account sign-in, correct callback, pending-invite precedence and intended-email checks remain to verify. An email not yet registered is not pre-created or pre-linked.

SCHOOL-01 — **PLANNED**: verified new-school self-service registration/request process for a school with no inviter. Requires verification ownership, duplicate-school handling, authorized signatory/staff checks, review/rejection/recovery and scoped initial principal provisioning. Current pilot coordination is manual; selecting the school onboarding path creates no school or role. Stage A/B; no native app publication or access grant is implied by installation.

Parent entry remembers no permanent account role preference. Parent users can choose Parent / caregiver at sign-in or use /parent; a later canonical product preference may improve returning-user routing without affecting permissions. Full parent record access remains FAM-01/02, not ENTRY-01.
