# Sprint 050 — Family verification readiness

Goal: explain precisely what families need before future school submission, without confusing completeness with verified guardianship.

Failure analysis: a required-photo label alone does not reveal missing contact/name/date/school details; a completed checklist might imply access approval. School names/references are unverified free text. No current PEOS guardian-write/verified school-invitation adapter exists. Do not infer canonical identities, search children by names, or create a competing relationship store.

Scope: pure typed completeness policy, owner-only saved-draft readiness projection, review checklist with navigation to missing details, explicit separate unverified school status. One caregiver and either cellphone or email suffice. Child names, birth date, profile photo and school name are the essential readiness fields. Reference, address and additional adults remain optional. Incomplete drafts remain saveable. No new schema or credentials.

Acceptance: per-child photo membership checked, missing fields map to correct steps, complete details never enable submission or imply verification. Tests cover one caregiver, unknown reference and multiple child photos. Existing authorization and draft boundaries remain enforced. No new data transfer.

Next integration contract requirements: PEOS must bind an opaque school-issued invitation to intended authenticated recipient, active school and permitted child scope; introspect current authoritative school/admin and guardian status server-side; use idempotent consented submission, auditable review and relationship provenance; reject revoked/expired/replayed invitations and stale drafts. Only after school-authorized confirmation may PEOS create canonical relationship/access grants. Names/references and photos are never identity proof. Photos remain owner-only until that adapter and explicit sharing purpose are implemented. Do not implement a pretend successful verification endpoint.

Release gate: automated checks and code review. This block is an explanation/readiness feature, not school submission activation.
