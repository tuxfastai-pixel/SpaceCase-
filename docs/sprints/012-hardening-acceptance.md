# Sprint 012 — Hardening Acceptance

Status: CODE FOUNDATION COMPLETE; awaiting final CI evidence.

Release-candidate code gate requires the exact branch head to pass migrations, migration verification, typecheck, lint, tests and production build. Security checks preserve PEOS canonical ownership, teacher-controlled communication, explicit Atlas onboarding/bridge authority, action-time revocation and cross-product minimization.

Production activation is deliberately outside this code gate and requires owner permission for merge/release, hosting, production database, OIDC, PEOS URL/config, messaging provider, Atlas production integration, real grants/entitlements and pilot data.
