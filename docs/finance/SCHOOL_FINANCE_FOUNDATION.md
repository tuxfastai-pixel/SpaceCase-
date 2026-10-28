# School finance foundation — prepared, not activated

School finance is independent of the school's SpaceCase subscription billing. The first implementation slice is internal, pure arithmetic; it has no HTTP endpoint, storage, bank connector, charge execution, authority grant or user-visible finance dashboard.

## Money and record invariants

The pilot currency is ZAR. Integer cents are represented as canonical decimal strings and computed with bigint, bounded by PostgreSQL signed bigint. Floating point, scientific notation and partial cents are rejected. Currency conversion and other minor-unit conventions require an explicit later contract.

Invoice totals multiply bounded integer quantities by integer unit prices and reject overflow. Instalment splitting preserves the total exactly, distributes remainder cents to the earliest instalments and rejects zero-valued instalments. No tariff, due date, grace period or penalty has been selected by these helpers.

Allocation planning accepts only verified payment facts, same school and financial account, matching supported currency, and an issued undisputed invoice. Requested allocations must fit both remaining payment and invoice balances. Unallocated money stays available; it is not discarded or silently applied to another learner. These are internal consistency checks, not evidence that payment was verified or that the caller is authorized.

## Required next implementation gates

- PEOS school-scoped finance permissions and principal delegation, with current server-side checks; family account identity and access must be independently linked to canonical guardian/learner relationships.
- Durable invoices, lines, payments, allocations, receipts, budgets, expenses and correction records. Actor/time/reason history; revisions, uniqueness and transaction locks prevent replay, overspending and duplicate settlement.
- Payment verification from authorized staff or a configured signed/reconciled provider flow. Never accept a browser `VERIFIED` claim as authority. Capture verified evidence privately; uploads alone do not prove payment.
- Principal approval rules and separation of preparation/approval, agreed period closing/reopening and reconciliation rules, document retention and access policies.
- Parent statements limited to their authorised family accounts. No general teacher, observer or founder access to school financial detail by default.
- Bank collection, debit orders, external accounting/tax documents, full payroll and automatic suspension/penalties remain separate inactive integrations/policies.

Do not wire the pure allocation plan directly to an API. Its facts must come from current authorized database reads inside the same transaction that commits any allocation.
