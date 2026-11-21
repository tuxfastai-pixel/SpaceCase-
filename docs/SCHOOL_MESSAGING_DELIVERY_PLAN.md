# School messaging delivery readiness

## Current milestone

SCH-MSG-01 adds preparation guidance during school registration and later School setup, with reusable help and a public guide. It creates no sender configuration, provider connection, permission record or delivery. Manual invitation sharing and parent acceptance have isolated pilot evidence; automated email/WhatsApp sending is not implemented.

## Release sequence

1. **Delivery foundation.** PEOS owns canonical notification delivery, sender/organisation bindings, immutable events and permission/suppression references. SpaceCase owns school onboarding, invitation review and contextual UI through versioned contracts. Prepare an idempotent outbox, per-recipient outcomes, bounded retries and current-authority checks. A network timeout must not cause a second invitation or message. Record queued, provider accepted, delivered where reported, failed and parent accepted separately. No bulk recipient disclosure.
2. **Email pilot.** Select and configure an approved outbound provider, verify a controlled sending domain, confirm school reply routing and authorised sender branding, then test delivery, bounces, replies, unsubscribe/suppression where applicable and invitation return paths. Do not label a browser composer draft as automatic sending or delivered.
3. **WhatsApp school onboarding.** Connect each school's authorised business sender through the chosen provider. Display verification and message-template approval outcomes from the provider, record expected-message permission, manage opt-out and route replies to the correct school's authorised team. No personal-number enrollment or existing WhatsApp account migration occurs from merely saving a school phone number.
4. **Bulk and reminders.** Exact learner-reference/email review, legitimate sibling connections, skipped duplicates, explicit expired renewal and bounded per-row creation. Reminders stop for accepted/revoked/declined invitations and suppression; timers never verify a parent or silently rotate tokens. Costs, limits, failure recovery and intervention are visible to the school.
5. **Live readiness.** In the isolated pilot, test one sender per channel, real delivery and reply routing, acceptance, independent school confirmation, wrong-account handling, revoked/expired links, duplicates, webhook authenticity, tenant isolation and phone/keyboard flows. Then authorise a separate production configuration/release; do not activate Production from the development guide.

## What determines the date

There is no supported production readiness date yet. Engineering can prepare the foundation before provider selection, but live delivery depends on the selected provider account, ownership of sender/domain, business verification and template approval where applicable, followed by end-to-end acceptance. External approvals must be tracked rather than assigned an invented completion date. An enabled flag, saved phone or passing mock is not readiness evidence.

## School experience

Registration remains usable while messaging is pending. Preparation guidance is brief and optional, with click/tap/keyboard help and visible hover/focus cues. A future connected setup should lead through Not started → Needs your attention / Waiting for approval → Ready to test → Enabled, using actual backend/provider state. SCH-MSG-01 only explains those future stages and explicitly does not claim to check school connection readiness.
