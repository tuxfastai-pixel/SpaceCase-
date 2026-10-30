# SpaceCase school finance integration contract (pilot)

## Ownership and architecture
- **SpaceCase** owns school financial records, invoices, payment evidence, reconciliation, parent statements, receipts, and the school-specific finance UI.
- **PEOS** owns identity, active school membership, school-scoped role assignments, and authorization decisions.
- PEOS currently also contains experimental `school_finance` tables and service modules (PRs 26–35). **Do not connect those PEOS tables to production school finance.** Treat them as provisional backend prototypes pending relocation/adaptation into SpaceCase storage. Avoid two authoritative ledgers.
- Subscription billing for SpaceCase itself is separate from school fee accounting.

## Principal security
- Principal must have active school-scoped PRINCIPAL authority verified server-side for private finance summary and approvals.
- School administrator role must never imply finance access. Finance officers/managers receive explicit school-scoped grants.
- UI role switching must never mint or elevate server authority; recheck PEOS on each sensitive server operation.
- Teachers, parents, observers and platform founder have no default access to school-wide financial detail.

## Pilot release gates
1. Establish the verified principal and scoped finance staff in PEOS.
2. Add school-owned ledger migration to SpaceCase database with immutable audit/correction records, unique references, and concurrency-safe allocations.
3. Validate payments from trusted bank reconciliation or authorized staff evidence. Never trust client-provided `VERIFIED` status.
4. Implement a server-side PEOS authorization adapter in SpaceCase; fail closed if PEOS is unavailable.
5. Implement school finance API endpoints with input validation, idempotency, school scoping, and transaction-level audit.
6. Create separate principal review and finance staff screens, then test cross-school isolation and preparer/approver separation.
7. Validate financial reporting, disputed/void payments, reversals, receipts, document privacy and exact integer-cent arithmetic.
8. Run database migrations in a staging environment and complete an end-to-end pilot before enabling production money workflows.

## Current implementation status
The SpaceCase repository contains pure arithmetic helpers only; they do not establish authorization or a durable ledger. PEOS financial modules are not a production integration. This document defines the boundary; it does not activate finance APIs or grant permissions.
