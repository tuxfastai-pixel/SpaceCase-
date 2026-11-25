# New notice composer focus


## New notice composer focus — 25 November 2026

User reports New notice appears inert while scrolled to My drafts. Source confirmed the button resets the composer above but neither scrolls nor focuses it; resetting an already empty step-1 editor yields no visible change. New notice now retains unsaved-change confirmation and busy/uncertain-operation guards, resets to recipient selection, clears old selection/error, announces the new notice, and scrolls/focuses a dedicated Create a notice heading. It does not fetch recipients, publish, save, skip review or discard persisted drafts. The existing Continue action still performs the current-authority audience check. Local type/lint, CI and isolated release are recorded separately; signed-in mouse/keyboard/phone visual confirmation remains pending. No API/schema/authority/message/Production/WhatsApp change.
