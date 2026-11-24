# General parent notice board


## MSG-04 — general parent notice board, 24 November 2026

User accepted the existing Finance private-message and school-branded sign-in walkthrough. That report does not establish a new general-board or external WhatsApp acceptance. WhatsApp testing is explicitly deferred by the user; its sender, transport and dispatch flags remain off.

Prepared a separate school-notices-v1 contract: current confirmed school-family relationships, active school/adult/learner/membership and class membership; no billing grant required. Principal/administrator may publish school/class notices; teachers only their current assigned classes and their own authored notices. Finance-only roles gain no general-school broadcast authority. Directory/audience checks are bounded and purpose-audited. No new identity, relationship or role store/grant.

SpaceCase owns immutable notice text, snapshot recipients deduplicated per parent, append-only private messages/read receipts/withdrawal and resolve/reopen events. Three guided steps, optional selected-parent subset, replies on/off and explicit review. The reviewed relationship set must still match current authority at publication; new recipients are not silently added after review. Idempotent publication and messages, safe held retry after unknown response, parent-specific threads, current revocation/class checks, future-read watermark rejection, numeric keyset message history, rate caps, and restricted runtime without overwrite/delete rights. Current pilot limits: at most 500 confirmed relationship rows per publication, 200 active classes per staff scope and 100 recent notices; oversized audiences fail closed and should be narrowed to a class. General/class notice delivery beyond these bounds requires paged audience review/dispatch, not silent truncation.

Parent School inbox includes school notices plus existing Finance activity notices, with combined bell count. School notices are available from staff administration/teacher workspaces and Principal Finance header; exact parent links preserve safe sign-in return. Private replies can be resolved/reopened; a parent follow-up reopens them. Published text cannot be overwritten: withdraw and issue a correction. Withdrawal hides notices/blocks new replies while retaining history. Read receipts measure opening in the visible foreground, not agreement or understanding. General learner evaluations/AI sends remain in their reviewed communication workflow; no attachments, off-app push or WhatsApp dispatch added.

Source prepared under SPACECASE_SCHOOL_NOTICES_ENABLED (default off). Isolated migration, companion contract release, full CI and signed-in desktop/phone/keyboard walkthrough pending. Production unchanged; no hosted notices/messages sent during development.

Acceptance: review and publish one synthetic school/class notice; see correct parent bell; read it; reply privately; answer as staff; verify read counts, no duplicate on retry and no other-family access; revoke/withdraw and verify access is stopped. Real external delivery is excluded.
