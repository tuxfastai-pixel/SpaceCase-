# School setup diagnostics
Goal: turn school setup gaps into clear explanations and next actions in the founder school profile.
Scope: derive missing workspace, classes, eligible teacher assignments and class connections from the existing authorized school profile. Qualify truncated class data.
Out of scope: automatic repairs, agent investigations, uptime measurements, learner access, notifications and new permissions.
Failure analysis: inactive workspaces must not create misleading per-class connection alerts; unrelated connected IDs must not hide gaps; a truncated profile must never imply complete coverage.
Acceptance: every gap explains an administrator action; complete displayed setup remains qualified; no records are changed.
Authorization: existing founder-only school endpoint remains unchanged; no extra data is fetched.
Validation: focused diagnostic behavior tests plus repository CI typecheck, lint, tests and build. Signed-in visual walkthrough remains pending because no browser execution environment is available.
