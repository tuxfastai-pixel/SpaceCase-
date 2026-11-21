# Parent workspace reception

Parents should see a clear next action after signing in or receiving school permission, rather than the generic staff onboarding message.

## Authority and routing

Use existing PEOS parent connections and current billing directories through server adapters. Discovery is a navigation hint and never grants access. Existing Finance and plan endpoints recheck authority. A confirmed contact alone returns no learner names or financial actions. Expired/revoked grants are excluded from home; outages are visibly distinct from an empty account. The home API accepts no learner/school/grant selector and returns only the signed-in account's minimal projection with private/no-store headers.

Founder, Principal, administrator, teacher and Finance destinations retain precedence. Only otherwise unassigned parent accounts with verified actor-scoped history/current grants route to /parent. A current staff school prevents the parent fallback from displacing the teaching dashboard. The generic unassigned welcome contains no editable submission and may recheck navigation on focus/visible intervals; parent home never automatically submits a financial action or switches away from an in-progress plan form.

## Home experience

One main card explains the current step: open school account, view confirmed connection, wait for school review, check an ended connection, start a private profile or refresh an unavailable check. The available account action has a bounded highlight respecting reduced motion. Learner names/reference appear only from current billing scopes, not invitations or matching surnames. Secondary family profile and help remain easy to reach. Future unfinished features live inside help rather than taking over the reception page.

The page rechecks access when revisited and every 30 seconds while visible. Rechecks do not repeatedly remount or flash the current card. No real-time push/email notification is claimed. Account opening still revalidates current permissions. Shared starting-path cards use the same simpler labels for new parent, teacher and school-office users.

## Acceptance

Behavior checks cover contact-only privacy, active grants and plan gates, expired/revoked access, staff routing precedence, unknown users, disabled services and partial failures. Full CI must pass before isolated release. Live acceptance still requires the actual parent sign-in/dashboard redirect, confirmation/grant refresh, grant revocation, dual-role staff navigation, mobile/keyboard/reduced-motion checks and no stale-data display after discovery failure. No Production activation is authorised by this feature.
