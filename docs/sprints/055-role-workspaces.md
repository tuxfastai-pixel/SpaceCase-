# Sprint 055 — Role landing and principal/admin views

Goal: route each signed-in canonical person to their current authorized home and let current principals switch between school oversight and administration below the SpaceCase brand.

Failure analysis: a missing staff/role assignment cannot be repaired by a UI label; failed admin role lookups were treated as an empty role list; the neutral fallback dashboard advertised Teacher OS; an old PEOS cookie could survive a failed account-switch attempt. These conditions must not be treated as current teacher authority.

Scope: additive principal boolean in PEOS's existing admin-school list, derived from active role/time/school/person/staff checks. Default home precedence is founder, principal, school administrator, then the existing teacher/welcome flow. Role lookup failure shows unavailable, never a teacher inference. /principal checks current canonical principal schools server-side; client class reads retain existing server authorization. The principal setup overview labels the 200-class/teacher bound and does not invent attendance or performance metrics. The under-brand switch preserves the selected authorized school across principal/admin views. It changes no roles. No email allowlists or client-submitted role grants.

OAuth account switching clears/revokes the old PEOS session before beginning Google selection, returns a cleared cookie on success and failure, and bounds upstream session requests. Account switching is accessible from teacher/founder/admin/principal headers. A failed provider request cannot reuse the old local PEOS cookie to appear as the newly selected account. Third-party sign-in remains explicit.

Validation: routing precedence, unavailable/malformed role response, clearing before OAuth, rejected provider origin/failure, missing clear cookie, current principal role/revocation in PostgreSQL CI, typecheck/lint/full suites/builds, synthetic switch/overview walkthrough. No new schema/secret/provider activation. Existing authorization guards stay independent of UI. Signed-in checks for each actual pilot account remain required after release.

Operational role repair was explicitly requested by the founder for an existing pilot account and existing school, checked against canonical external identity, and audited in PEOS. No real addresses or person IDs are stored in repository fixtures or this document. Founder/teacher assignments were not changed. Account session-activity lookup was rejected as unnecessary; no session history was retrieved.
