# ADR 0001 — Technology Baseline

## Status

Accepted for Sprint 001 foundation.

## Context

SpaceCase begins as an empty repository but must support a production-oriented Teacher OS without collapsing PEOS, Atlas HDOS, or PSG AI Platform responsibilities into the product.

## Decision

SpaceCase will begin as a modular monolith with explicit service-extractable domain boundaries.

Initial baseline:

- Next.js App Router
- React
- TypeScript
- PostgreSQL for durable SpaceCase-owned product records
- runtime input validation at trust boundaries
- server-side authorization policy layer
- PEOS adapter for shared identity and governance
- PSG AI Platform adapter for AI execution
- Atlas adapter for versioned referral, onboarding, support-request, and bounded-outcome contracts
- automated unit/integration/authorization testing
- Playwright for end-to-end browser validation
- structured logs and auditable sensitive actions

## Consequences

- SpaceCase must not introduce canonical user/parent/teacher identity tables as a shortcut.
- UI visibility is not authorization.
- Product domains may coexist in one deployment initially, but domain interfaces must remain explicit.
- New major frameworks, runtimes, or persistence technologies require a new ADR.
- Database and external integration contracts must be versioned before dependent production flows.
