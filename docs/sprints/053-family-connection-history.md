# Family connection history and self-service withdrawal

Parents can open My school connections from their workspace, family setup or invitation receipt. The signed-in PEOS person owns the list; the client cannot choose another owner or school. The list shows school name, proposed relationship, dates, a request reference and current status. It excludes learner identities, school records, private intake contents, photos and medical information. Contact confirmation does not grant learner-record access.

Withdraw my connection requires an explicit confirmation. PEOS serializes this with administrator review and revocation on the invitation row, revokes the matching active contact link and records a metadata-only audit event. It does not alter enrolment, school records or the private family draft. Reconnection requires a new school invitation. Failed/uncertain mutations hide stale rows and preserve the error until the user refreshes.

Administrator review opens on pending school review, with filters for awaiting parent acceptance, confirmed contacts and all invitations. Existing pagination and independent-review requirements remain.

No database migration, credential change, automatic email delivery or new product access is introduced. API responses are private/no-store. Security tests cover strict ownership inputs, same-origin mutation checks, status projection, cross-owner denial, withdrawal, stale tokens and absence of role grants. Database-backed tests run in CI against synthetic records.
