# Sprint 007 — Communication

Status: ACTIVE

Goal: establish teacher-controlled school-family communication without coupling SpaceCase to a live delivery provider.

Invariant workflow:
`DRAFT -> REVIEWED -> APPROVED -> SENT`

Rules:
- AI may assist drafting but cannot approve or send.
- Editing reviewed content returns it to DRAFT.
- SEND is impossible without prior teacher approval.
- Communication purpose is bounded to school-operational purposes.
- Recipient identity/contact resolution belongs behind governed PEOS/integration contracts; raw parent contact data is not introduced into this sprint.
- Atlas developmental data is not a valid communication purpose.
- External email/SMS delivery is intentionally deferred until provider selection and explicit production integration permission.
