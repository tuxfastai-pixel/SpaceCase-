# Security Release Checklist

Before production activation, verify on the exact candidate head:

- [ ] All CI gates green.
- [ ] No hardcoded credentials or production secrets in repository content.
- [ ] PEOS remains canonical identity/role/consent/entitlement authority.
- [ ] Every learner-sensitive action re-evaluates current educator authority.
- [ ] Communication cannot send before authenticated teacher approval.
- [ ] Atlas referral token contains no PII and grants no data access.
- [ ] Atlas onboarding requires explicit scoped guardian grant.
- [ ] Atlas bridge requires entitlement, consent, educator authority, permitted purpose, and current contract version.
- [ ] Cross-product payloads exclude Growth DNA, raw conversations/reflections, family discussions, diagnoses, and credentials by default.
- [ ] Revocation is tested at action time.
- [ ] Production database backups, retention, observability, incident response, and key rotation are configured outside source control.
- [ ] Live email/SMS and AI providers are separately approved and configured.
- [ ] Production smoke test uses controlled pilot identities only after owner authorization.
