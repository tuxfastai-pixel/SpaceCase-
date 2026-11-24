# Notice-board navigation repair


## MSG-04 navigation repair — 24 November 2026

User could not find School notices and Parent inbox in the respective role workspaces; the new general-board walkthrough remains pending. Confirmed omissions: Principal overview had no School notices entry, and the parent school-account header had no inbox entry. Staff notices previously appeared in administration/teacher navigation and the Principal Finance header; relying on those locations was insufficient.

Prepared explicit School notices navigation plus a prominent action card on Principal overview, and the same destination in the Principal-authorised Finance sidebar. Parent home now consistently says Parent inbox, with a prominent inbox action and an entry in learner account options. Parent school-account pages receive the current inbox-enabled flag from the server and show the bell/inbox link in the header; header wrapping preserves small-screen access. All links reuse existing read-count services and canonical page/API authorization. No role/grant/recipient change, no publication or message send, no migration, no WhatsApp/configuration or Production change. Source/type/lint/build/isolated release evidence is recorded separately; signed-in role/phone walkthrough remains required.

Acceptance: Principal overview and Principal Finance sidebar expose School notices for the current school; Parent home and parent school-account header expose Parent inbox with a bell; links stay visible before account data loads; no permissions are inferred from a navigation link.
