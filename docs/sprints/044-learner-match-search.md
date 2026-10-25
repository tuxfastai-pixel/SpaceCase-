# Sprint 044 — Find learners while matching photos

Goal: reduce scrolling when matching uploaded work to a class roster.

Scope: local search by given name, family name/surname and school reference, with whitespace-separated terms matched case-insensitively. Show a clear empty result and preserve the selected learner even when a search excludes them. Search never selects, saves or changes a match. Approved work remains locked.

Failure analysis: search silently changing an existing selection, hidden selected options, false save success, network disclosure of names/search terms, and losing unsaved selection during filtering.

Acceptance: search narrows the existing authorized roster; selected option remains available; clearing search restores the full roster; Save match and existing server authorization remain required. No schema, network requests, telemetry, AI calls, automatic identity inference or new dependencies.

Validation: typecheck, lint, production build and review of selection preservation/empty search/locked approved states. Production release requires separate approval.
