# Sprint 024 — Teacher workspace and daily overview

Goal: make released teacher tools easy to find and expose a truthful, class-scoped daily overview.

Scope: responsive class selector and search; class selection preserved in the return URL; actionable tool cards for roster, attendance, planner, assessment, homework and observations; selected-class daily attendance progress, today's saved lessons, assigned homework due or due within seven days, uploaded work awaiting teacher review, unmatched photos and due observation follow-ups. Setup and unavailable states remain explicit. Planned capabilities have a separate roadmap rather than appearing to be working tools.

Out of scope: additional teaching modules, AI activation, automated notifications, new learner data, browser-persisted class choices, school-wide analytics and founder access changes. No schema migration is needed.

Failure analysis: an old class response must not replace a new selection; mount the day view by class key and abort requests on unmount. Unknown/unavailable summaries never become zero counts. Class tools remain reachable if the day summary fails. Every summary request rechecks PEOS identity, teacher assignment and the current roster. Queries scope teacher-private work to actor/school/class; attendance counts only current roster marks; learner-linked assessments and follow-ups exclude former learners. A repeatable-read transaction, workspace locks and statement timeout bound summary reads. Ordinary audit stores only the date and resource class. The projection excludes names, learner IDs, photos, assessment scores and observation narrative.

Acceptance: clearly accessible class tools on desktop and mobile; only configured assigned classes expose operational links; zero class/setup paths retained; today's date follows school timezone; absent is never inferred from unmarked; homework counts are tasks, not learners; review counts require uploaded work and no approved result; follow-up counts require current learners and OPEN records; no fabricated metrics or cached cross-user projections.

Tests: HTTP unsigned/revoked/roster failures and strict projection validation; PostgreSQL fixture verifies actual records, ownership, class/school boundaries, current roster filtering, date boundary and inactive workspaces; workspace model checks valid class routing and malformed authority payloads. Complete CI, both builds and unsigned live checks before release.

Visual verification limitation: the local Playwright package is available but Chromium is absent and its download failed. No signed-in or synthetic desktop/mobile browser walkthrough is claimed. Typecheck, lint, model tests, backend boundary tests and builds remain required.
