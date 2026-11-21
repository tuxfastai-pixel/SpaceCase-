# Isolated Finance Preview evidence — 12 November 2026

Result: **40 deployed synthetic HTTP checks passed** across the dedicated PEOS/SpaceCase test pair. This is live network/database evidence using short-lived synthetic PEOS sessions, not a Google sign-in or physical-phone walkthrough. No real learner, family, banking or payment data was used, and no outbound messages were delivered.

## Source and deployment pair

| Component | Pinned source | Deployed evidence |
| --- | --- | --- |
| SpaceCase | `6eeb90182a0a152056fa2f41586b2173678ebd20` | Dedicated Preview project `prj_H20d8jYzF5zN80bAuARJUA5i8uKR`; final READY staging deployment `dpl_7c5NEDRG9H9XdXFwAuij3maKpn4S`; same-source branch deployment served the resumed test while that final build completed |
| PEOS | `eec230d1aaddfd949ad08f4b2bfce101aac309cb` | Dedicated Preview project `prj_pOSAxbOrZATecuUUN9aHymvsd5VK`; READY staging deployment `dpl_G4GigxAChWgLxnQWqWazfJbMir4c` |
| Source validation | SpaceCase implementation above | [CI 43258147072](https://github.com/tuxfastai-pixel/SpaceCase-/actions/runs/43258147072): 292 product tests, 23 service tests, zero skips/failures, migration/runtime/restore checks, typecheck, lint and both builds |

Protected test URL: https://spacecase-finance-test-git-feat-1e5700-tuxfastai-3244s-projects.vercel.app . It requires Vercel access and a valid application session. Do not present it as Google-login-ready.

## Data isolation and privileges

Both new databases were queried and had zero application tables before migration. Created them inside the separate existing Finance preview Neon projects, never from a Production snapshot or existing preview identities. SpaceCase has 20 migrations; PEOS has 10. Every recorded migration name/checksum was compared with the repository files and matched exactly.

- SpaceCase runtime cannot use `school_ops`, update invoice/payment amounts or submitted reconciliation versions, or delete audit events; it has no superuser/RLS bypass. School workspaces were provisioned by the privileged synthetic setup, not by Finance initialization.
- PEOS runtime is separate from its schema owner and has no superuser/RLS bypass. Explicit service grants and private-table service policies support canonical synthetic identity/organisation/session operations. No product service writes to the other's database.
- Only two synthetic schools, five synthetic staff-role identities and one synthetic learner were seeded. Test sessions were stored as hashes, limited to one hour, then explicitly revoked after verification. The officer role is ended following the revocation check.

## Passed live scenarios

| Group | Checks | Observed result |
| --- | ---: | --- |
| Direct PEOS authority/discovery/learner contract | 10 | Correct principal/manager permissions; officer/teacher/wrong-school denial; scoped school directory and exact synthetic learner lookup |
| SpaceCase-to-PEOS Finance workflow | 26 | Authorized read/setup; teacher/second-school denial; learner lookup; unverified allocation denial; manager verification; officer allocation; principal budget/expense/reconciliation decisions; over-budget denial; audit JSON/CSV and restricted-role denial; signed-in server-rendered Finance page; same-person payment verification denied |
| Manual synthetic Finance invitations | 3 | Principal creation, manager denial and principal revocation; no delivery |
| Current role revocation | 1 | Same unexpired officer session received HTTP 403 on its next Finance read after the role ended |

The workflow resumed existing synthetic invoice/payment fixtures after fixing the runtime issue below. Their initial restricted-runtime creation was already observed on the preceding transport implementation. Final database queries confirmed exactly R100.01 allocated, R70.00 approved expenditure, one approved reconciliation and one audited CSV export. The second R70 expense could not be approved against the R100 budget. A manager's reported self-payment remained unverified.

## Runtime issue found and fixed

The first deployed run returned 503 on allocation. An independent restricted-role query reproduced `permission denied for table invoices`: `SELECT ... FOR UPDATE` requires an UPDATE privilege that immutable invoices deliberately do not have. Removed those redundant payment/invoice locks; the existing active-account lock serializes all Finance service writes. No runtime privilege was widened. Added a restricted-role allocation-path regression, passed CI, and observed both unverified allocation denial and successful verified allocation in the deployed rerun. The failed attempt created no allocation.

## Deployment protection and cleanup

Vercel Authentication remains enabled for all deployments in both new projects. Vercel rejected the narrowly scoped cross-project Trusted Sources rule with 404, so the new test pair uses the supported automation credential only in the server-side Preview transport. User authentication and current school/action/person checks remain mandatory. Production/development ignore that optional credential. It is stored only in the new SpaceCase test project's Preview secret, never source/client output.

The separate temporary engineering access credential was revoked after verification, and all synthetic sessions were revoked. The server-only PEOS test-project connection credential remains necessary while the protected test pair is retained; revoke it when the test environment is retired or replace it with Trusted Sources when available. New-project initial deployments were automatically labelled Production by Vercel but had no Production database/environment credentials; actual tests used Preview deployments. Existing product Production projects and the authority-only pilot remain unchanged.

## Remaining gates

- Configure and verify an isolated Google/Supabase OIDC issuer, redirect/callback allowlist and intended synthetic credential mappings. No new public login bypass or test-account picker was added.
- Execute browser/phone role walkthroughs, account switching, sign-out/back-navigation and independent reviewer sign-off. A server-rendered HTTP page is not visual or physical-phone evidence.
- Complete principal identity verification, step-up/recovery policy, evidence storage/retention and effective active/ended Finance-team status before sensitive live use.
- Production Finance remains unactivated. Bulk whole-account export and human-readable audit actor resolution remain separate unfinished functions.

Machine-readable results: [FINANCE_PREVIEW_EVIDENCE_20261112.json](FINANCE_PREVIEW_EVIDENCE_20261112.json). No credentials, session tokens, invitation links or real recipient data are included.
