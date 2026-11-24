# Notice-board navigation repair


## MSG-04 navigation repair — 24 November 2026

User could not find School notices and Parent inbox in the respective role workspaces; the new general-board walkthrough remains pending. Confirmed omissions: Principal overview had no School notices entry, and the parent school-account header had no inbox entry. Staff notices previously appeared in administration/teacher navigation and the Principal Finance header; relying on those locations was insufficient.

Prepared explicit School notices navigation plus a prominent action card on Principal overview, and the same destination in the Principal-authorised Finance sidebar. Parent home now consistently says Parent inbox, with a prominent inbox action and an entry in learner account options. Parent school-account pages receive the current inbox-enabled flag from the server and show the bell/inbox link in the header; header wrapping preserves small-screen access. All links reuse existing read-count services and canonical page/API authorization. No role/grant/recipient change, no publication or message send, no migration, no WhatsApp/configuration or Production change. Source/type/lint/build/isolated release evidence is recorded separately; signed-in role/phone walkthrough remains required.

Acceptance: Principal overview and Principal Finance sidebar expose School notices for the current school; Parent home and parent school-account header expose Parent inbox with a bell; links stay visible before account data loads; no permissions are inferred from a navigation link.


Release check — 24 November 2026: navigation repair source 222f1dcc67a0fe884b8b07ec23b6326ac6876c92 integrated by fast-forward into protected feature/finance-workspace-completion. CI run 45453650736/job 138657157208 passed 411 product and 23 service tests plus required type/lint/migration/runtime/restore/build checks. Existing SPACECASE_SCHOOL_NOTICES_ENABLED and SPACECASE_PARENT_INBOX_ENABLED were read back true only for the isolated protected-branch Preview. No activation change was needed. Preview deployment dpl_DfyPD3Wq7TKwsTHqxMmmjVei9HP3 is READY; the stable Finance test alias was assigned and read back against the exact tested source SHA and protected ref. Signed-in role/phone discovery acceptance remains pending, and the user should refresh existing tabs to load changed navigation. No database migration or PEOS, identity, permission, message, notice-publication, WhatsApp or Production change.
