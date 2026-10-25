# ADR 0027 — Unverified family onboarding intake

Status: accepted for implementation, not production activation.

PEOS owns canonical people, guardian relationships, contact identity and consent. Current SpaceCase PEOS adapters introspect a session and read educator/school authority; they do not provide a verified guardian onboarding/write contract. Collecting a child's details must never establish access by matching a name, reference, address or self-selected relationship.

The first stage is an owner-only draft at /family/onboarding. It collects self-authored statements in a separate family_intake schema, not an alternate canonical person directory. There is one draft per authenticated PEOS person. Draft child/contact IDs are local form identifiers with no identity meaning. No endpoint accepts an owner supplied by the client, lists other owners, looks up learners, submits claims, approves a relationship, creates invitations or transfers data to PEOS/Atlas/AI.

Draft saves use strict bounded input and compare-and-swap revision checks. Metadata-only save/clear events commit atomically with each mutation. Clearing removes the profile JSON and advances the revision; the tombstone prevents stale tabs recreating or overwriting a cleared draft using an old revision. Audit contains the account reference, action, revision and timestamp, never names, dates, contacts, address or copied payloads. No personal details go to localStorage, sessionStorage or URLs. Browser memory is lost on leaving unless explicitly saved.

The user is told that draft content remains until cleared. Owner clear is available and deliberately distinct from school-record deletion. Infrastructure backup retention and operator access still apply; do not claim instant erasure from backups. A production retention/operator policy must be confirmed before activation and expansion. A draft is a preparatory intake, not proof of guardianship, an emergency contact record accepted by a school, enrolment or family communication consent.

Future stages: PEOS-owned verification contract; invited-parent email and school binding; school-authorised correction requests rather than identity overwrites; per-child relationship and contact scopes; reviewed submission queue and source acknowledgements; private optional photo storage with retention; verified parent workspace. Each requires separate tests/activation. No existing child record is displayed to an unverified applicant.
