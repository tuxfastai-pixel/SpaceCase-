# SpaceCase System Architecture

## Portfolio position

SpaceCase is an independent PSG education product. It consumes PEOS and PSG AI Platform capabilities and integrates with Atlas HDOS through explicit contracts.

```text
PEOS
  identity · relationships · organisations · roles · permissions · consent · entitlements · audit
      │
      ├───────────────┐
      │               │
SPACECASE          ATLAS HDOS
  │                   │
 STOS            Growth DNA / Atlas Tutor
  │                   │
  └──── versioned SpaceCase <-> Atlas Bridge ────┘

PSG AI Platform provides shared model/agent/tool infrastructure to both products under product-specific policy.
```

## SpaceCase architecture style

SpaceCase begins as a modular monolith. Product domains are isolated by explicit interfaces so they can later be extracted without redesigning ownership boundaries.

Primary domains:

- schools/classes context adapters
- learners
- teaching
- lessons
- assessments
- homework
- attendance
- behaviour
- observations
- interventions
- communication
- reports
- resources
- workload
- analytics
- professional development
- Atlas bridge

Platform adapters:

- PEOS
- authorization
- PSG AI Platform
- audit
- notifications

## Core learner separation

Three records must remain conceptually and technically distinct:

1. PEOS Person and relationship/organisation records — canonical shared identity and authority.
2. SpaceCase School Learning Profile — school-context learning evidence, progress, support, and intervention history.
3. Atlas Development Profile — developmental evidence, Growth DNA, Atlas missions, recommendations, and tutoring history.

No profile may silently become the other profile.

## Teacher authorization path

Every sensitive teacher operation must follow:

```text
authenticated identity
  -> PEOS active staff membership
  -> teacher/class/learner assignment
  -> SpaceCase policy decision
  -> domain operation
  -> audit where required
```

Knowing a learner ID is never sufficient authorization.

## Parent communication path

```text
authorized school evidence
  -> AI-assisted draft
  -> teacher review/edit
  -> teacher approval
  -> send
```

AI has drafting authority, not autonomous publishing authority, for evaluative learner communication.

## Atlas integration states

### Atlas not subscribed

SpaceCase remains fully usable. Teachers can maintain school learning profiles, observations, interventions, and parent communication.

### Atlas referral

A parent may follow an opaque SpaceCase referral into Atlas. Atlas may request explicit permission to import a minimal set of SpaceCase/PEOS-backed onboarding information. Referral alone grants no data access.

### Atlas connected

Ongoing teacher-to-Atlas support requires valid entitlement, explicit parent consent, authorized teacher scope, permitted purpose, and a current versioned contract.

SpaceCase sends bounded SchoolSupportRequest payloads. Atlas returns bounded SchoolSupportOutcome payloads. SpaceCase does not receive unrestricted Atlas transcripts, family conversations, private reflections, or full Growth DNA by default.
