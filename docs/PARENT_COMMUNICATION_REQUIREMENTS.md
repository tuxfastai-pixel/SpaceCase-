# Parent communication: notice board, inbox and WhatsApp

Confirmed by the user on 24 November 2026: both the SpaceCase inbox and the actual WhatsApp service are required. This is a planned communication capability, not a claim of delivery activation. Existing Finance offers do not send messages today.

## Parent experience

An authorised school publication or Finance offer creates a targeted inbox item. The parent sees an unread badge and, when permitted/configured, a phone push notification and a WhatsApp notification. Tapping opens the exact notice/activity and preserves that destination through sign-in. Actions stay short: View notice, Take part, Ask a question. App notification permission is distinct from WhatsApp channel preference and from financial authority.

The notice board is the original school announcement; the inbox is its personal entry point. Broad school/class announcements and learner-specific financial offers must have different recipient rules. A private financial offer must never become a general notice-board post. Only targeted authorised contacts can see it. Sensitive balances or child details should not appear in public previews/lock-screen notifications by default.

Ask a question opens a private parent–school thread tied to the notice/offer. Finance questions route to authorised Finance staff, classroom questions to the appropriate school staff, and unclassified questions to a school triage inbox. Other families cannot see private replies. Staff have one assigned inbox, unread/reply status, conversation history and open/resolved state. The school controls whether an announcement permits replies; a support route remains visible. Do not invent round-the-clock availability or AI responses sent as school staff.

Actual WhatsApp supports inbound and outbound conversation, not just a manual wa.me link. Verified inbound replies should join the same school conversation where identity/context can be established safely. A phone number alone is not financial authority. Ambiguous senders, shared/reassigned numbers and missing reply context route to safe verification/triage, never disclosure of a learner's account. Financial acceptance and payment-plan changes require authenticated, currently authorised SpaceCase confirmation; a chat reply is not payment proof or an instruction to change the ledger.

## Ownership and reliable delivery

SpaceCase owns school notices, activity context and school conversation records. PEOS owns canonical identity, family/school relationships, current permissions, preferences/consent, routing authority and shared notification delivery contracts. Do not create a competing identity/consent store.

Use durable publication/resource events and recipient-specific delivery jobs with current authority checks at materialisation, dispatch, open and reply. Unique event/recipient/channel keys prevent duplicate notices. Track queued, provider-accepted, delivered, failed and read separately; provider acceptance is not delivery and opening a WhatsApp notification is not necessarily reading the app notice. Verified signed callbacks, deduplicated webhook events, retry/backoff, expiry/cancellation and lost-response recovery are required. A notice must not disappear because WhatsApp failed. Persist the app notification independently and expose truthful delivery failures to authorised staff.

No polling UI may silently broaden recipients or send on page load. School publication remains explicit and evaluative teacher communication retains required human review. Archived/cancelled activities, withdrawn family access, opt-outs, disabled channels and ended staff roles must stop future unauthorised access/dispatch. Retain proportionate audit/history without recipient lists or credentials in repository documentation. Define attachment/abuse controls and file retention before collecting chat attachments; use text-only first.

## Activation and acceptance

Stage: REQUIREMENTS CONFIRMED / NOT IMPLEMENTED OR ENABLED. Build isolated in-app notices/private threads and an event-to-notice flow first, then connect a separately disabled WhatsApp adapter and verified inbound/status handlers. Phone push needs explicit browser/device subscription and platform support; an in-app unread badge alone is not off-app delivery.

WhatsApp activation requires the business messaging account/number connection, access credentials held securely, tested webhook configuration, appropriate recipient permissions/preferences, supported outbound message formats/templates and an agreed cost limit. Decide the pilot sender and the per-school production sender model before connecting numbers. No paid account creation, external sending or real-parent test is authorised by this requirement note; prepare the complete reviewable flow first and choose an explicitly approved test recipient for delivery acceptance.

Official platform reference checked 24 November 2026: https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/ describes business-number send/receive APIs, messaging, templates and webhooks. Specific template/window/pricing eligibility must be checked against current Meta documentation at implementation/activation, not assumed from an old policy summary.

Acceptance must include targeted offer→app inbox→exact notice, authorised parent query→correct staff inbox→private reply, WhatsApp inbound/outbound and status callbacks, offline/reconnect and notification permission denial, correct sign-in return, cross-family/school isolation, revoked/expired/shared-number cases, duplicate/crashed delivery, failed-channel recovery, mobile/keyboard walkthrough and zero unintended ledger writes. Keep existing Finance/ACT-PAY/proof/notification gates open until their own evidence is complete.
