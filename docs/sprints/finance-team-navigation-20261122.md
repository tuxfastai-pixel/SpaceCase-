# Direct Finance team navigation

Goal: make finance staffing easy to find during school setup and later administration.

Scope: Principal-only direct Finance menu section, an always-open team card, and links from Principal overview, administration beside Invite staff, and School setup. Preserve the selected school and focus the destination after authorised account load.

Out of scope: role changes, automatic invitations, registration activation, provider delivery or Production configuration.

Acceptance: Principal can open the team directly from each entry point; non-Principals do not see management entries; server authority remains required; reload/deep-link opens the intended school/team; ordinary reviews remain available in Review & reconcile.

Validation: local typecheck, lint and three existing Finance presentation tests passed. Local production build also passed (existing CSS compatibility warning only). Preview release and signed-in keyboard/phone walkthrough pending. No new tests added for this reversible navigation change. Existing server permission checks are unchanged.


Release: 775da60bfc3bbc67e3e5c723c1be9fbf1c24861c advanced protected development by expected-head fast-forward. Correct-ref isolated Preview deployment dpl_3FF1YfttF87UMH9Lbx1nHth8Hocs reached READY and was assigned to the stable Finance test alias; alias readback confirmed exact SHA/ref and READY. Production unchanged. No database or permission changes. Local build/type/lint and three presentation tests passed; full CI was still running at release, and signed-in keyboard/phone acceptance remains pending. No browser walkthrough claimed. Principal test entry: /finance?school=<current school>#finance-team.
