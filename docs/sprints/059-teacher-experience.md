# Sprint 059 — A calmer teacher workspace

Goal: make the teacher’s next action clear, retain every existing tool and distinguish locally selected source files from confirmed private saves.

Scope: warm responsive dashboard surfaces, current-class quick actions, concise navigation to existing destinations, a three-stage assessment journey, and persistent status beside source selectors with a continuation into the definition form. Help stays beside tools. No new message/assistant tool is advertised as operational.

Acceptance: current class scopes every shortcut; incomplete setup retains its existing gates; source feedback distinguishes empty/preparing/local pending/saved states; the saved count comes from the server source listing; partial failure never reports all files saved; continuation focuses the existing form without saving, opening, discarding a queue or inventing questions; all existing manual marking, privacy, authority and confirmation rules remain.

Out of scope: new API/schema, email/AI/OCR activation, fabricated personalisation, learner analytics, changing permissions, or replacing parent/admin/founder surfaces in this slice.

Validation: typecheck and lint pass initially; synthetic desktop/phone-width visual and continuation checks plus CI/release evidence to be recorded. Synthetic screens do not establish physical camera or live private storage behavior.

User evidence, 26 October 2026: founder reports a successful real teacher source upload. Device, format, retry, isolation and retention scenarios were not independently observed, so QA-03/04 remain open.

Rollback: restore the prior app deployment; no data migration or configuration rollback is needed.

Verification closeout: initial full CI 40387771671 passed all PostgreSQL migration/integration and both app/service build gates. Local 243 passed / 19 database-dependent skips, typecheck/lint and whitespace checks pass. Synthetic preview dpl_9rH28sCNRA7TX6MNpjc9jcC4HxMM: desktop teacher navigation/current-class links and saved-source continuation observed; a true 390px iframe viewport showed responsive teacher and assessment layouts, readable file controls/saved feedback and successful continuation focus. An initial navigation timeout recovered; this was not a completed physical-phone test. Saved source was a fictional server-list fixture, not a real object upload. File chooser/retry/partial-failure flow is still not independently exercised. Loading and failed-upload feedback tightened after review; current-head CI remains required.
