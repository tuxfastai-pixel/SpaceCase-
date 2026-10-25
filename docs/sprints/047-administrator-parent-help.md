# Sprint 047 — Administrator and parent guidance

Goal: extend highlighted role-specific assistance beyond teacher tools.
Scope: administrator/principal help above school actions; worked examples for setup, invitations, bulk invitations, class/teacher assignment, learner enrolment, billing and support; contextual cards in setup, invitations, class management, bulk import and administrator roster. Add an informational parent/guardian guide at /help/parents linked from sign-in and administrator help.

Current-state finding: no parent workspace or authorised parent record API exists in this repository. Parent help therefore states that limitation prominently and directs users to school channels. It grants no access, infers no relationship and promises no parent delivery or consent controls.

Failure analysis: teacher examples misapplied to administrators; invitation creation confused with email delivery; revoke confused with removing accepted membership; learner registration mistaken for parent linking; public help leaking school data; parent help implying a functional portal; auth checks accidentally changed.

Acceptance: help is easy to find and uses existing highlighted native disclosure controls; examples create no records; admin guide matches actual buttons; parent page works without sign-in but contains only static general information; correct role boundaries and manual invitation delivery are explicit; no auth, database or notification changes. Principal title alone does not grant administration access.

Validation: typecheck, lint, build, CI; synthetic preview tests of role guides, expandable keyboard controls, parent availability and phone layout. No real learner records required. Parent record access and signed-in parent walkthrough are not claimed.
Release: production approval separate. Rollback removes guides/links without affecting records.
