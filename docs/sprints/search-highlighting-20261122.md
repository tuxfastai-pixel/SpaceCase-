# Search result guidance

Goal: users can immediately identify what their search found.

Scope: shared SearchResults/SearchMatch components, applied to all six current text search/exact-lookup surfaces: financial audit, founder school directory, teacher class picker, assessment learner matcher, invoice learner lookup and activity-charge learner lookup. Matching terms stay marked while the query is active. Server-filtered audit results have an outline and visible searched action/reference codes. Submitted results scroll/focus; live searches preserve typing focus. No matches remain explicitly empty, without marking unrelated records. Future text search screens should reuse these components.

Out of scope: new search indexes, expanded data scope, altered permissions, automatic record selection/submission, messaging or Production changes. Existing server access checks and filter semantics unchanged.

Related correction: rejected receipts say Cannot allocate — rejected. User screenshots showed synthetic rejection saved and its reason retained in the audit trail; no new financial decision was made by this build.

Validation: typecheck/lint and six focused tests passed. Tests cover literal pattern characters and markup-like strings, case/repetition/overlap, original-text preservation and empty/unmatched input. Production build passed (existing CSS compatibility warning only). Preview release and signed-in keyboard/phone checks pending.


Release evidence: implementation d831e8468a52df0baea148a78b1dcd49a92deec6, protected development expected-head fast-forward. Isolated Preview deployment dpl_233w7a4RoYZ55rskJTqTRU8aMnDL reached READY on the correct protected ref, was assigned to the stable Finance test alias, and read back to the same exact SHA/ref. Local type/lint/build and six focused tests passed. Full CI runs 45044123332 / 45044117970 were still running at release; no full-CI pass claimed here. No Production, database, financial-decision or permission changes. Signed-in keyboard/phone/repeated-search/clear-filter acceptance remains pending.
