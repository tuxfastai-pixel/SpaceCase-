# Sprints 008–011 — Integration Foundations

Status: FOUNDATION IMPLEMENTED; production integrations intentionally not activated.

## Sprint 008 — STA Foundation
STA has a bounded capability router. Ordinary teacher capabilities remain in SpaceCase. Atlas requests can only route through the Atlas adapter, and learner-sensitive capabilities require learner authority.

## Sprint 009 — Atlas Referral
Referral tokens are opaque, random, short-lived, and contain no PII. A referral token grants no data access by itself.

## Sprint 010 — Atlas Onboarding
Accelerated onboarding must be backed by explicit, scoped PEOS permission/consent. SpaceCase does not create a competing consent record or copy Atlas profile state.

## Sprint 011 — Atlas Bridge
The bridge is default-deny and requires all of: active Atlas entitlement, active guardian consent, authorized educator, permitted educational purpose, and current versioned contract. Revocation must stop future access at action time.

No live Atlas endpoint, production consent grant, entitlement, or external AI provider is fabricated by these foundations. Activation remains an external integration/release action.
