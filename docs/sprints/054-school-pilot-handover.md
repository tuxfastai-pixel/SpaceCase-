# Sprint 054 — School pilot handover

Goal: help an invited pilot school exercise the actual teacher/admin day and record blockers without implying that unfinished features work.

Scope: public instruction-only /pilot guide; 18 role walkthroughs; transient self-reported results; minimal JSON export; catalog-bound issue links; links from teacher/founder/admin/parent help; correction of stale parent-help availability copy. The public guide reads no school/learner data, creates no accounts and grants no access. Existing workspaces/APIs enforce their own authorization. Guide content does not represent current runtime feature detection.

Failure analysis: invitations can be accepted without a class assignment; a saved draft can be mistaken for a submitted school profile; missing AI/email can be mistaken for a broken tool; a checked box can be mistaken for trusted verification; reports can leak learner data. The guide explains each distinction. Export whitelists catalog IDs, verdicts, timestamp, version and an optional valid public commit SHA. Unknown keys/URL text are excluded. No account/school identity, free-text notes, credentials, tokens, photos, localStorage, sessionStorage or network write is added.

Acceptance: untouched/unknown verdicts never count as passed; role switching retains in-page observations; leaving/reload clears with visible warning; exported files are self-reported and grant no launch approval; support prefill is an editable title from a known check ID only. Creating a ticket still requires school authority, a user-written description and explicit submission. Parent accounts without school staff authority use their coordinator for the current support flow.

Out of scope: trusted verification or sign-off store, provider/email/AI activation, production synthetic identities, paid services, permission changes, new schema, full parent records and production capacity certification. A failed critical gate cannot be overridden by a percentage.

Validation: contract tests for counts, export minimization and issue-title input; typecheck/lint/full CI/build; synthetic browser check where available. Live school role, phone, private storage and recovery checks remain open in the completion register.
