# Sprint 056 — Parent entry and non-privileged onboarding choices

Goal: let new users choose their starting journey without making self-declared roles an access-control mechanism.

Scope: sign-in choices for assigned workspace, parent/caregiver, teacher and principal/administrator. A bounded validated choice travels through OAuth in a ten-minute HttpOnly SameSite cookie; callback and logout clear it. Pending family/staff invitation processing retains precedence. Destinations are a fixed allowlist. No email is hardcoded, prefilled into URLs, invited or assigned a school role by this flow.

The new /parent workspace requires a valid current PEOS session and offers existing owner-only family drafts, connection history and help. Google sign-in creates the canonical account under existing verified self-signup rules. It creates no school membership, child identity/link, guardianship proof or learner-record permission. An account that has never signed in cannot safely be pre-linked by email. Parent entry is a product journey, not a new global authorization role. Use the parent choice or parent entry URL to return; no persistent role preference store is introduced.

Teacher/school entry checks existing canonical founder/admin/principal authority and redirects current assigned users accordingly. Eligible current teachers can return to their existing workspace. Unassigned users receive instructions for email-bound school invitations and separate class assignment. New-school registration/verification requests are not implemented; the page explicitly directs pilot schools to their agreed coordinator. Selecting Principal must never bootstrap an administrator, school or permission. Founder is never a self-service role option.

Acceptance: anonymous /parent redirects to sign-in with parent preselected; the parent path reaches /parent after successful authentication unless a pending invitation requires completion. Invalid paths cannot open arbitrary URLs or assign roles. Unassigned dashboard offers the role guides instead of appearing teacher-only. Existing role precedence is preserved for assigned-workspace sign-in. Account-switch clearing and all existing authorization guards remain.

Out of scope: child-record access, draft submission, native app/store publication, automatic invitations/email, unverified school creation, parent support-ticket authority, migrations, real/synthetic production accounts and persistent role preferences. Download/installation does not itself grant a role.

Validation: strict path/cookie/priority tests, existing session/family authorization tests, full CI and production builds, synthetic form/parent-home walkthrough. First actual parent Google sign-in and school confirmation remain live acceptance work.
