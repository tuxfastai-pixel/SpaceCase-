# Sprint 045 — Teacher examples and clearer workflow guidance

Goal: help teachers understand what to enter, why an action is needed and what it saves, without needing engineering explanations.

Scope: a teacher-workspace examples index covering every current class tool; contextual expandable help on roster, attendance, planner, assessments, homework, observations and reports; separate worked examples for assessment definition, learner matching and review/reading/approval; always-visible assessment field examples. Examples use fictional learners and do not prefill or create records.

Failure analysis: examples mistaken for real records; a demonstration submitting data; overwhelming routine screens; confusing save with approval or delivery; implying AI is activated; hidden help on phones; report help appearing in printed learner reports; incorrect instructions for current button/state behavior.

Acceptance: each teacher class tool offers a worked example explaining purpose, steps and saved outcome; assessment guidance explains rubric, per-question mark rules and page numbering; search and automatic recognition are distinguished; reading, scoring, approval and notifications are distinguished; native details controls work by keyboard and on narrow screens; examples are excluded from printing; no authentication, API, schema or save logic changes.

Validation: typecheck, lint, production build; actual-component synthetic browser preview for overview, disclosure controls and assessment form examples; database-backed CI. No real school or learner records are required for help testing.

Out of scope: admin/founder training, interactive practice database, automatic assessment generation, activation of AI or notification delivery, or changes to marking policy. School administration and founder flows need their own role-specific example review rather than teacher instructions copied into them.

Release: approval for production deployment remains separate. Rollback removes contextual help and leaves saved records unchanged.
