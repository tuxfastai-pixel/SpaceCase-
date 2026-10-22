# ADR 0013 — Evidence-oriented classroom notes

Store operational teacher observations in SpaceCase, referencing PEOS identifiers without copying learner names. Each record is private to its creator and class. The current teacher assignment and canonical roster authorize every read/write. Out-of-scope former learners are excluded even from list totals and history; unknown and unauthorized record IDs return the same not-found response.

Use three bounded categories: positive observation, learning support and behaviour support. They describe the teacher's purpose and do not classify the learner. Teacher-written observable evidence, response and next step remain separate from diagnosis, AI judgments and Atlas developmental records. No model or delivery provider is involved.

Records are OPEN, RESOLVED or RETRACTED. Resolution requires an outcome, reopening preserves that outcome in history, and retraction requires an explicit reason and is terminal. Editing an open note requires a correction reason. A single increasing revision and task-specific advisory lock reject stale copies. Every successful mutation appends a full snapshot to an immutable revisions table in the same transaction. Normal audit events contain action and revision only. Recent history exposes revision summaries; old content remains retained for governed audit, not broad dashboard browsing.

Dates follow the existing school timezone. Future observation dates fail; follow-up dates may be future. Follow-up due indicators never send notifications or infer diagnoses, severity or discipline scores. The UI clearly describes the private, unmonitored nature of this notebook and the use of school procedures for urgent concerns.
