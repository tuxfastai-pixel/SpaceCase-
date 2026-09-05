# SpaceCase

SpaceCase is the Pinnacle Sentle Group education operating environment. The first production surface is **SpaceCase Teacher OS (STOS)**.

## Engineering status

Sprint 001 — Foundation: **PASS**.

Sprint 002 — Identity Boundary: **ACTIVE**.

Current identity-boundary goals:

- resolve authenticated teacher sessions through PEOS;
- derive canonical person, school, role, and class authority from PEOS;
- keep authorization server-side and fail closed on missing or mismatched identity context;
- support PEOS-backed browser sessions without creating a competing SpaceCase identity store;
- establish the validated path from authenticated teacher to STOS workspace before learner-domain implementation expands.

Current authority chain:

```text
Authenticated teacher
        ↓
PEOS canonical Person
        ↓
active school staff membership
        ↓
current role assignment
        ↓
current class assignment
        ↓
SpaceCase authorization policy
        ↓
STOS teacher workspace
```

## Product boundaries

- **PEOS** owns canonical identity, relationships, schools/organisations, roles, permissions, consent, membership, entitlement, and shared governance.
- **SpaceCase** owns teacher workflows, school-operational records, school-learning records, interventions, and school-family communication.
- **Atlas HDOS** owns developmental intelligence, Growth DNA, Atlas missions, tutoring behaviour, and Atlas developmental records.
- **PSG AI Platform** owns shared AI runtime infrastructure.

SpaceCase and Atlas do not share databases. Cross-product access must use versioned, purpose-limited contracts with current authorization and consent.

## Initial STOS capability domains

Dashboard, classes, learners, teaching, lesson planning, assessments, homework, attendance, behaviour, observations, interventions, communication, reports, resources, workload, analytics, professional development, wellbeing, STA, and the Atlas bridge.

## Development

Read `PROJECT_CONSTITUTION.md` before making changes.

Every production change must pass PostgreSQL migration validation, typecheck, lint, automated tests, and production build before release actions are considered.
