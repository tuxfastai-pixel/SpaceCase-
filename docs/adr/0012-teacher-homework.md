# ADR 0012 — Teacher-private homework with audited completion

Homework belongs to SpaceCase learning operations; PEOS remains the canonical class and learner authority. Reuse the existing teacher context and paginated roster adapters, without adding learner identity tables.

Each teacher owns independent class tasks. DRAFT permits instruction editing. ASSIGNED permits completion updates. CLOSED requires explicit reopening before correction. Assigned task wording remains fixed to preserve the meaning of previous outcomes. Completion is operational tracking, never a grade or AI judgment.

Use one task revision for state, content and register writes; transaction advisory lock plus revision comparison rejects stale copies. Completion saves cover exactly the current roster and merge retained historical learner outcomes. Detail reads filter historical outcomes to current learners. Append-only homework events retain before/after status and reason, while ordinary product audit records only action/revision. Runtime has SELECT/INSERT on events and no deletion privileges.

Dates are calendar dates interpreted using the existing school workspace timezone. Overdue is informational; pending work never becomes automatically incomplete. No notification is sent by assigning a task. A later delivery integration must use the governed communication boundary.
