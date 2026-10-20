
# Sprint 014 — Founder control centre and support
Goal: provide a real issue-reporting loop and operational founder oversight before adding engineering-agent execution.
Acceptance: signed-in current staff can submit bounded reports, receive a stable reference, track only their own authorised requests, add replies and reopen resolved issues. The founder can search an alphabetical school directory, preview aggregate counts, inspect setup gaps and support events, triage tickets, prepare immutable recommendations and record a decision. Role revocation blocks the next request. School admins cannot acquire founder authority. No learner records are exposed by default; no automated work or email delivery is claimed.

Checks: both repository CI gates; integration coverage for global-vs-school role scope, revocation, aggregate minimisation, current staff count, idempotent submission races, rate bounds, revision conflicts, private tickets, retained recommendation content, superseded decisions and no-execution approval. Migration 0008 tested on an isolated Neon branch before production. Live activation requires explicit provisioning of the existing verified founder person in PEOS, not an email allowlist.

Operational entry points: /support and /founder. The support link appears throughout the app with an area label. Founder entry is available in the authorised user's support hub. Schools without configured workspaces can still report setup problems. Readiness checks prove support table access. Existing learner records and attendance are unchanged.
