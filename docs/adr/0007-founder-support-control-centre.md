
# ADR 0007: Operational founder oversight and private support
Status: Accepted

PEOS owns a distinct active global SPACECASE_FOUNDER role, checked on every request. School administrator roles do not imply platform access. Founder directory contracts expose names and aggregate counts plus bounded class setup details; they never return learner identities or records.

SpaceCase owns private support tickets, append-only user-visible events and immutable recommendation content. Tickets remain visible only to their reporter with current school staff authority, or a current founder through the founder endpoint. No anonymous submissions, public GitHub issues, screenshots, session replay, raw logs or automatic learner data collection are introduced. Page context is a bounded area label, never a full URL or query string.

Submissions have stable client request IDs, payload hashes and a transaction-scoped per-person lock; retries cannot duplicate or change a committed report. At most five new reports per person per hour are accepted. Status/reply updates use expected revisions. Recommendation creation and decisions lock the ticket; only the latest undecided proposal can be decided. Content is never overwritten. Approval needs a prepared SpaceCase/PEOS pull-request reference and records a founder decision only: it does not verify the PR, execute code, deploy or resolve the ticket.

The product runtime receives SELECT/INSERT/UPDATE on tickets, SELECT/INSERT on events and proposal content, and column-limited decision updates. PUBLIC access is revoked. Audit events store operation IDs and states, not submitted narratives. School audit previews intentionally exclude attendance and learner audit payloads. Founder support content is information explicitly submitted for support, not broad access to school records.

First release: alphabetical directory, accessible quick previews, aggregate school profiles, setup-gap signals, contextual issue reporting, acknowledgements, owner replies/reopening, founder queue and manual recommendation decisions. Agent investigation teams, principal-engineer automation, attachments, restricted learner-access grants, delivery notifications and self-healing execution are deferred and must not be simulated. No provider cost or billing data is fabricated.
