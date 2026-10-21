# Sprint 012 — Hardening

Status: ACTIVE

Hardening gates before release candidate:
- default-deny authorization at every learner-sensitive boundary
- PEOS identity/person binding and current school/class authority
- explicit consent/entitlement/purpose/version checks for Atlas bridge
- revocation evaluated at action time
- cross-product data minimization
- teacher approval before school-family communication send
- migration ledger and required-table verification in CI
- typecheck, lint, tests, production build
- no hardcoded secrets
- no fabricated external provider contracts
- no production deployment without explicit authorization

A release candidate may be declared only after the final branch head completes the full GitHub Actions validation gate successfully. Live deployment, production database creation, OIDC configuration, outbound messaging provider activation, Atlas production connectivity, PR/merge, and production secrets remain explicit-permission actions.
