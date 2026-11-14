# Finance automation — Execution Pack

| ID | Stage | Acceptance and dependency | Status |
|---|---|---|---|
| FIN-AUTO-01 | CSV intake | Bound parser, preview, saved mapping, idempotent imports, duplicate queue, tenant tests | Engineering Preview verified; human import walkthrough pending |
| FIN-AUTO-02 | Review and matching | Explain exact suggestions; reported-only conversion; independent verification; duplicate decisions/audit | Initial slice engineering Preview verified; wider matching planned |
| FIN-AUTO-03 | Provider connector | Select pilot provider/account; sandbox webhook signature/replay/reversal tests; no live money | Planned, provider selection pending |
| FIN-AUTO-04 | Statements/reminders | Approved fee schedule batch preparation, arrangements/disputes, preview and authorized delivery | Planned; delivery setup pending |
| FIN-AUTO-05 | Expenses/approval pack | Evidence intake, extraction review, duplicate handling, scoped principal queue | Planned; evidence retention/storage gate |
| FIN-AUTO-06 | Accounting sync | Choose accounting product; scoped credentials; approved export/outbox/conflicts | Planned, vendor selection pending |
| FIN-AUTO-07 | Email/bank adapters | Dedicated intake route or least-privilege mailbox; no email-as-settlement; supported bank source | Planned, source selection pending |
| FIN-AUTO-08 | Daily brief and saved work | Truthful queue counts, resumable mapping, connection health, measured processing indicators | Initial intake counts; wider brief planned |
| FIN-AUTO-09 | Visible revision history | Expand earlier rejected decisions with source revision/time/reason | Planned, audit projection review |

## First implementation verification
Parser: BOM, quoting/newlines, delimiter, exact cents, invalid calendar dates, comma decimals, malformed CSV, row/size bounds, debit exclusion, header/mapping mismatch. Service/Postgres: same file replay, overlapping batches, conflicting source transaction IDs, concurrent import/report, duplicate decisions, wrong school/account, revoked authority, exact suggestion only, no verified money or allocations, audit rollback, restricted runtime grants. HTTP: disabled flag, same-origin, strict scope and bounded bodies. UI: mapping preview/import/candidate actions and keyboard/mobile walkthrough. Existing Finance/CI regression checks must stay green.

## Release procedure
Use protected development branch. Migrate and exercise disposable/isolated database first. Deploy only feature-gated isolated Preview after source checks and runtime privileges pass; use synthetic records. Do not infer migration, activation, successful synchronization or human acceptance from a build. Record commit, migration checksum, check results and observed Preview configuration in FEATURE_COMPLETION_REGISTER. No Production activation, outbound messages, paid connectors or real bank data in this build.

## Definition of completion
A stage is complete only with its authorization/duplicate/audit invariants tested and its real user flow observed. Prepared source, CI success, deployed disabled code and connected live features are separate statuses. Remaining user decisions must name the actual provider/account/vendor; do all provider-independent work first.
