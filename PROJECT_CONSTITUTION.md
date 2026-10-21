# SpaceCase Project Constitution

## Purpose

This constitution governs SpaceCase engineering. Every contributor, agent, and Codex session must read it before making production changes.

SpaceCase is part of the Pinnacle Sentle Group engineering portfolio. It is an independent education product that consumes shared PSG capabilities but must not absorb the responsibilities of PEOS, Atlas HDOS, or the PSG AI Platform.

## Mission

Build an AI-assisted education operating environment that reduces teacher administrative burden, improves teaching support, strengthens school-family communication, and enables evidence-led learner support while preserving human agency, child privacy, professional teacher authority, and clear product boundaries.

## Product Position

SpaceCase includes teacher, school, parent/family, learner, and education operations capabilities. The first production surface is SpaceCase Teacher OS (STOS).

STOS must remain useful even when no family subscribes to Atlas.

## Portfolio Boundaries

- PEOS is the shared PSG operational platform for canonical identity, relationships, organizations, roles, permissions, consent, product membership, entitlements, governance, notifications, and shared integration contracts.
- PSG AI Platform is the shared AI infrastructure for model access, agents, tools, retrieval, memory, prompts, evaluation, policy, safety, usage, and observability.
- Atlas HDOS owns developmental intelligence, Growth DNA, Atlas missions, developmental evidence, recommendations, and Atlas tutoring/intervention behavior.
- SpaceCase owns school-operational and school-learning records, teacher workflows, school interventions, school-family communication, and the SpaceCase side of governed product integrations.
- SpaceCase must not create a competing canonical identity store or silently duplicate PEOS responsibilities.
- SpaceCase and Atlas must not share databases or assume access merely because both are PSG products.

## STOS Principles

STOS is a full teacher operating system, not a thin Atlas integration layer. It should support teaching, planning, assessment, homework, learner management, attendance, behaviour, communication, reports, resources, workload, analytics, professional development, wellbeing support, and AI-assisted teacher workflows.

The SpaceCase Teacher Assistant (STA) is the primary AI front door. Specialist assistants are capability profiles with bounded tools and permissions rather than independent uncontrolled AI systems.

## Child and Learner Data

- Collect only data necessary for a defined educational purpose.
- Keep canonical identity and relationship data in PEOS.
- Treat school learning records and Atlas developmental records as separate profiles.
- Do not silently merge the SpaceCase School Learning Profile with Atlas Growth DNA or the Atlas Development Profile.
- Teacher observations must use observable, evidence-oriented language and must not be treated as diagnoses.
- A teacher observation must never directly mutate Atlas Growth DNA.
- Cross-product data transfer must be purpose-limited, versioned, authorized, and auditable.
- Consent revocation must stop future access and future cross-product data transfer.

## Teacher Authority and Authorization

- Knowing a learner identifier grants no access.
- Teacher access derives from authenticated identity plus active PEOS school membership and teacher assignment.
- Authorization is enforced server-side at the time of the action.
- Different school roles may have different scopes.
- Sensitive actions must be auditable.
- AI must not bypass teacher authorization or product policy.

## Parent Communication

AI may draft parent communication, progress summaries, report comments, and meeting preparation material from authorized records.

Evaluative communication about a learner must follow this sequence:

AI DRAFT -> TEACHER REVIEW -> OPTIONAL EDIT -> TEACHER APPROVAL -> SEND

AI must not silently send child evaluations in a teacher's name.

## Atlas Referral and Onboarding

Atlas is optional.

- A SpaceCase parent may follow a traceable Atlas referral link.
- Referral tokens must be opaque and must not place child or parent personally identifiable information in the URL.
- Atlas may offer accelerated onboarding to a parent arriving from SpaceCase.
- SpaceCase data may be transferred for onboarding only after the parent reviews and explicitly grants permission for the requested data scopes.
- Imported onboarding information must be shown to the parent for confirmation.

Subscription is not consent.

A parent may subscribe to Atlas without connecting the child's school or SpaceCase records.

## SpaceCase <-> Atlas Bridge

Ongoing school-to-Atlas integration requires all of the following:

1. valid Atlas entitlement,
2. explicit parent/guardian school-integration consent,
3. authorized educator access for that learner,
4. a permitted educational purpose,
5. a current versioned contract.

Teachers may send bounded school-support requests to Atlas when these gates pass. Atlas owns the tutoring/intervention method. Atlas may return only bounded school-support outcomes required for teacher follow-up.

SpaceCase must not receive unrestricted Atlas conversations, private learner reflections, family discussions, unrelated developmental history, or the full Growth DNA profile by default.

## AI Rules

- AI must not invent learner facts, teacher facts, credentials, assessment results, or school records.
- AI must not diagnose medical, psychological, developmental, or learning conditions from SpaceCase records.
- AI access must be purpose-scoped and tool-scoped.
- Sensitive records may be sent to AI only through approved and documented data flows.
- Prompts, tools, retrieval sources, model boundaries, policy checks, and meaningful AI executions must be traceable.
- Human agency and teacher professional judgment take priority over automation.

## Security and Privacy

- Never hard-code secrets, tokens, credentials, or private keys.
- Apply least privilege to users, services, agents, and integrations.
- Validate input at every trust boundary.
- Authorization must be enforced independently of UI visibility.
- Maintain auditable records for sensitive access, consent, integration transfer, and teacher approval actions.
- Build privacy, retention, revocation, and data minimization into the domain model rather than adding them after launch.

## Architecture Principles

- Begin as a modular monolith with explicit, service-extractable domain boundaries.
- Prefer PostgreSQL for durable product records.
- Design data models and authorization rules before dependent flows.
- Keep PEOS, PSG AI Platform, and Atlas behind adapters and versioned integration contracts.
- Avoid hidden cross-domain writes.
- Use typed interfaces and runtime validation at boundaries.
- Record major architecture decisions in ADRs.
- Add tests for behavior, authorization, privacy, and integration boundaries, not only happy-path UI behavior.

## Design Philosophy

SpaceCase should feel calm, useful, professional, supportive, and teacher-centred.

- Reduce cognitive and administrative load.
- Prioritize clarity and actionability over decorative complexity.
- Support accessible, responsive, repeated daily use.
- Show empty or unknown states truthfully rather than fabricating metrics.
- Use the PSG Design System when it becomes available.

## CHEP 3.0 Delivery Discipline

SpaceCase engineering follows the PSG CHEP workflow:

- reverse-engineering failure analysis before implementation,
- explicit architecture and product boundaries,
- controlled implementation groups and validation gates,
- evidence-led decisions,
- no silent scope expansion,
- verification before release.

## Sprint Workflow

Every sprint must define:

- goal,
- scope,
- out-of-scope items,
- acceptance criteria,
- security and authorization expectations,
- test expectations,
- required documentation updates.

Large changes require an ADR or implementation plan.

## Acceptance Standard

A change is acceptable only when it:

- supports the SpaceCase mission,
- preserves PEOS and Atlas ownership boundaries,
- enforces server-side authorization,
- respects child and family privacy,
- follows documented AI boundaries,
- has clear acceptance criteria,
- passes appropriate automated or manual validation,
- does not introduce unapproved secrets, frameworks, dependencies, or cross-product coupling.
