# Editable public-school calendar defaults

Goal: avoid manually entering a complete activity year before testing activities.

New drafts start with 2027 learner dates; selector/button offers 2026 or 2027 verified templates. Templates replace unsaved date/name fields only on explicit action; payment settings are retained and all fields editable. Saved calendars are never overwritten and current Principal server authority remains required for saving. No school-year or charge is automatically saved. Future unpublished years are not extrapolated. Half-years are suggested term groupings, not gazetted policy.

Sources verified 23 November 2026:
- https://www.education.gov.za/Portals/0/Documents/Publications/2025/Published%202027%20School%20Calendar.pdf — final Gazette 52178, 25 February 2025; learner dates rather than educator administration days. The gov.za summary conflicts on term 3/4; final published table confirmed by Western Cape education's approved 2027 circular.
- https://www.education.gov.za/Portals/0/Documents/Publications/2025/Published%202026%20School%20Calendar.pdf — final Gazette 52177, 25 February 2025.

Acceptance: Principal opens prefilled draft, can edit all dates, can explicitly switch template while preserving payment choices, saves only after review; previous saved versions unchanged. Independent-school dates can be entered manually.

Validation: local typecheck/lint and two tests passed (both calendars pass policy schema; 2027 final term 3/4 regression and independent editable copies). Local production build passed (existing CSS warning only). Preview release and signed-in draft/edit/save walkthrough pending. No hosted data or permissions changed.


Release: implementation 6eebae6e1f246916503011332060d7a1696d4ad9 fast-forwarded protected development. Correct-ref isolated Preview deployment dpl_6rr3NBpVPFqCv7d5GyTHXpRZpdLv reached READY, stable Finance alias assigned, readback exact SHA/READY confirmed. Local build/type/lint and two focused tests passed. Exact-head CI push run 45167677838 was finishing at deployment; signed-in editable-draft/save acceptance remains pending. No Production/data/permission changes. Refreshing clears unsaved form state; only saved records persist.
