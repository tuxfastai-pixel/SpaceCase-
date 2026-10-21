# SpaceCase Release Readiness

## Code gate
A candidate is code-ready only when the exact head passes database migrations, migration-state verification, TypeScript, lint, tests, and production build.

## External activation gate
Code-ready does not mean production-ready. The following require explicit owner authorization and real external configuration:
1. PR/merge into the release branch.
2. Production deployment.
3. Production PostgreSQL and migrations.
4. OIDC issuer/audience/JWKS configuration.
5. PEOS production URL and secrets/configuration.
6. Outbound email/SMS provider selection and activation.
7. Atlas production endpoint/contract activation.
8. Real guardian consent and entitlement provisioning.
9. Production pilot identities/data.

Until those gates are approved, SpaceCase must remain fail-closed rather than simulate successful external integrations.
