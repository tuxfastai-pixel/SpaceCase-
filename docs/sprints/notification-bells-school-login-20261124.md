# Notification bells and school sign-in branding


## MSG-04 / school sign-in appearance — 24 November 2026

Prepared notification bells across current parent inbox, Finance header/sidebar, notice and conversation rows. Red badges count actual unread conversations/notices (not fabricated message totals), cap visually at 99+, refresh on foreground/focus and successful read/send/resolve events, and announce accessible status. Reading still requires visible foreground conversation and existing current authority. Actual WhatsApp and off-app push remain off; generic/class messaging surfaces not yet built are not claimed live.

Prepared school-branded sign-in: a bounded public-facing name projection, sourced exclusively from current PEOS-scoped school directories on authorised logo access. Login reads only this public name plus the current normalized raster school logo, using a validated UUID school hint; it never reads learner/family records. A 30-day HttpOnly SameSite=Lax appearance cookie remembers the last recognised school on this device and grants no authority; explicit school links override it. Unknown, malformed, missing or unavailable branding safely uses SpaceCase. Existing school permission checks and Google sign-in destinations are unchanged. Logo setup provides the shareable /login?school=UUID link. New migration 20261124150000_school_login_branding.sql is additive. Production untouched. Source implementation and local tests prepared; CI, isolated migration/deployment and visual desktop/phone walkthrough pending.

Acceptance: correct per-account unread state; read updates bell; failed lookup does not claim zero; keyboard/screen-reader labels; school name/logo on recognised sign-in, safe generic fallback, no authority from school selection.
