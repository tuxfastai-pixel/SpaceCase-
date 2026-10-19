# Workspace storage activation and recovery

1. Connect a dedicated SpaceCase PostgreSQL database through the deployment's sensitive DATABASE_URL setting. Do not paste credentials into issues, commits or chat. Do not reuse the PEOS database. No paid database is provisioned by this milestone.
2. Run the repository checksum-controlled migrations using the dedicated database's authorized migration connection: npm run db:migrate. Check all six existing migration names/checksums and the expected schemas/tables. Never run this against PEOS.
3. Require /api/ready to return 200, then use School administration → School learning workspace to save the school timezone/year and synchronize current classes. This UI requires current school authority and real database writes; it cannot simulate success.
4. Verify save/reload and configure a provider backup schedule, retention, operational owner and alerting. Restore to a separate isolated database; compare schema, representative authorized school/class settings and audit records. Record recovery time and permissible data loss. Restore credentials and backup files remain private. Production backup/restore is not verified merely by passing CI rollback tests.
5. Only then change production SPACECASE_WORKSPACE_MODE to operational and redeploy. Verify assigned teacher context and operational reads. Enrolment/rosters can be tested independently through PEOS while storage setup is blocked.
6. On rollout failure, roll back application code or explicitly return to authority_only to expose class setup/rosters only. Do not silently fall back and do not drop or reset learner/learning records. For data recovery, isolate the incident, restore into a separate database, verify integrity and switch the production connection only after the recovery review.

Current release adds storage readiness and configuration UI but does not assert a working production database, completed migrations, provider backups, or tested production restoration. These need evidence from the connected database, not source-level assumptions.

### Learner references and names

The enrolment form labels the surname as “Family name / surname” and explains given names separately. References are school admission numbers, 1–40 characters, starting with a letter or digit and containing only letters, digits, full stops, underscores, slashes or hyphens. Inline guidance and validation explain that spaces are not accepted.

For a new learner without a school reference, the administrator can select “I don’t have a school reference”. The browser generates a cryptographically random `SC-` UUID reference for review before submission. It remains stable through failed submissions, uses the existing PEOS validation and school uniqueness checks, and appears in results and the roster after saving. Reuse the existing reference for an existing learner; generation does not deduplicate identities by name. CSV imports still require references; use the single-learner form for missing references.
