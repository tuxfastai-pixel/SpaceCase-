# SpaceCase

SpaceCase is the Pinnacle Sentle Group education operating environment. The first production surface is **SpaceCase Teacher OS (STOS)**.

## Engineering status

This repository is in Sprint 001 — Foundation.

Current goals:

- establish the project constitution and architecture boundaries;
- scaffold the TypeScript/Next.js application;
- define PEOS, PSG AI Platform, and Atlas adapter boundaries;
- establish testing, health, environment, and CI foundations;
- avoid implementing learner features until identity and authorization interfaces exist.

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

Sprint 001 acceptance requires the application to boot and pass typecheck, lint, tests, production build, migration validation, environment validation, health checks, and interface checks for authorization, PEOS, AI, and Atlas integrations.
