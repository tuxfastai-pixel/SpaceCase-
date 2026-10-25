# Sprint 052 — School-issued family invitations and review

Goal: move from private drafts toward verified school connections using PEOS-owned identity and relationship records.

Failure analysis: staff invitations grant staff roles and must not be reused for parents; typed names/references must not authorize access; invitation links may be forwarded; claims may race/replay/expire; school authority may be revoked between issue and claim; medical/private draft data must not be swept into verification automatically.

Scope: companion PEOS contract (PEOS PR14) and disabled SpaceCase UI/proxy integration. From an administrator class roster, invite an intended adult for a selected enrolled learner. Opaque link appears once, delivery remains disabled. Parent token travels in fragment then is stripped into a bounded HttpOnly same-site cookie. Existing Google choice and verified email adapter bind it to the canonical person. Claim needs explicit acknowledgement and waits for school review. Different school administrator attests evidence, confirms or declines; revoke invalidates the link. Confirmation is school contact provenance, not legal guardianship or school-record access.

SpaceCase activation: SPACECASE_FAMILY_INVITATIONS_ENABLED must be exactly true; default false. All new route handlers enforce the switch. Same-origin mutations, bounded strict bodies and server-only identity token forwarding. PEOS authenticates and authorizes every operation. No direct PEOS database access. No draft/photo/address/medical transfer and no messages sent.

Acceptance: disabled defaults; intended-email/current-role/school/learner checks; expired/revoked/cross-school denied; independent review; no staff/product/access grants from claim or confirmation; audit excludes tokens/emails/medical data; revocation atomic. CI must pass both repositories. Browser synthetic and signed-in integration checks are release gates; no success claim from mocks alone.

Release order: approve/rehearse PEOS migration in isolated branch; inspect privileges/RLS; deploy PEOS PR14; deploy companion SpaceCase PR; activate flag only after tests. Production has NOT been changed for this sprint. No new credentials or paid service activation. Pending review UX is a request receipt; persistent parent connection history and actual family-record views are the next stage.
