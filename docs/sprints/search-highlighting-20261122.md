# Search result guidance

Goal: users can immediately identify what their search found.

Scope: shared SearchResults/SearchMatch components, applied to all six current text search/exact-lookup surfaces: financial audit, founder school directory, teacher class picker, assessment learner matcher, invoice learner lookup and activity-charge learner lookup. Matching terms stay marked while the query is active. Server-filtered audit results have an outline and visible searched action/reference codes. Submitted results scroll/focus; live searches preserve typing focus. No matches remain explicitly empty, without marking unrelated records. Future text search screens should reuse these components.

Out of scope: new search indexes, expanded data scope, altered permissions, automatic record selection/submission, messaging or Production changes. Existing server access checks and filter semantics unchanged.

Related correction: rejected receipts say Cannot allocate — rejected. User screenshots showed synthetic rejection saved and its reason retained in the audit trail; no new financial decision was made by this build.

Validation: typecheck/lint and six focused tests passed. Tests cover literal pattern characters and markup-like strings, case/repetition/overlap, original-text preservation and empty/unmatched input. Production build passed (existing CSS compatibility warning only). Preview release and signed-in keyboard/phone checks pending.
