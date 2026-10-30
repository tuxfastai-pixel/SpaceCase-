# ADR: School finance ownership and PEOS integration boundary

Status: Proposed — integration not activated

## Context

SpaceCase owns school-operational financial records; PEOS owns canonical people, school organisations, active role assignments and governance. Existing SpaceCase `domains/school-finance/money.ts` provides exact ZAR arithmetic but no durable finance API. PEOS currently has experimental finance tables and services in `school_finance`. This is a boundary mismatch: PEOS should not become the permanent system of record for school fee invoices or payments.

## Decision

1. Keep **canonical authorization** in PEOS. Every SpaceCase finance request must resolve the current authenticated person, active school and role/permission using a server-to-server, purpose-scoped PEOS contract. Never trust a browser role or school ID alone.
2. Keep **durable finance records** in SpaceCase's database: fee schedules, learner invoices, payment evidence/verification, allocations, receipts, reconciliation evidence, budgets, expenses, audit and correction history.
3. Treat existing PEOS finance tables/services as **non-production transitional prototypes**. Do not activate, copy real school finance data into, or expose their APIs. Plan retirement or replacement after SpaceCase-owned services pass integration tests.
4. Preserve SpaceCase's canonical decimal-string cents / bigint contract and ZAR-only pilot scope. Do not silently convert browser floats into money. Validate DB bigint bounds.
5. Enforce finance permission on every read/write server-side; principals can review/approve but cannot approve their own preparation. Finance staff have explicit delegation. School administrators, teachers, parents and founders receive no blanket finance access.
6. A payment may be allocated only after independently verified evidence, with transactional locks, same school/account/currency checks, idempotency, no over-allocation, and immutable correction/audit history.
7. Parents see only statements for their PEOS-authorized guardian/learner relationships. Cross-school and cross-family leakage is forbidden.
8. Do not infer production readiness from a passing CI run; require isolated DB migration tests, authorization tests, concurrency tests, reconciliation correctness, and browser role tests.

## Implementation sequence

- FIN-A: Design SpaceCase-owned finance schema and migration (fees, invoices, payments, evidence, allocations, reconciliations), with account-level school isolation and audit events.
- FIN-B: Implement PEOS permission adapter with fail-closed server-to-server verification, bounded caching (or no caching for writes), and revoked-role tests.
- FIN-C: Implement invoice, verified-payment and allocation transactions using existing `money.ts` contracts, row locks and duplicate-event protection.
- FIN-D: Implement reconciliation evidence, review and period close controls, plus ledger-consistent read models.
- FIN-E: Add principal/finance dashboards showing real data or truthful empty states. No demo totals in production.
- FIN-F: End-to-end multi-school and role tests, migration verification, privacy/security review, preview pilot, then separately authorized production activation.

## Acceptance criteria

No school finance writes without PEOS-current authority; no unverified payment allocation; no cross-school access; no same-actor reconciliation approval; no duplicate settlement; every mutation audited; no production finance data in PEOS; clear evidence for financial reporting.

## Explicitly out of scope

Bank integration, payment gateway, debit orders, payroll, automatic suspension/reconnection fees, multi-currency, external tax filing, and production data migration until separately designed and verified.
