# Sprint 007 — Communication Acceptance

Status: CODE FOUNDATION COMPLETE; awaiting final CI evidence.

Implemented invariants:
- message purposes are school-bounded
- workflow is DRAFT -> REVIEWED -> APPROVED -> SENT
- reviewed edits return to DRAFT
- draft cannot be sent directly
- only the authenticated approving teacher may authorize SEND
- AI assistance is represented as provenance only and has no approval/send authority
- raw parent contact data is not introduced as a local identity source
- external delivery provider activation is deferred to explicit production integration permission
