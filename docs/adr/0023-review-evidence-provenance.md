# ADR 0023 — Review evidence collection and provenance

Status: foundation implemented; production adapters and storage pending.

Failure analysis: accepting an uploaded screenshot, a passing test claim or a checked “reviewed” box as verified proof would allow approval without independent review. Existing review summaries must continue to block approval until authoritative evidence can be obtained. Public REST review comments alone do not establish complete, resolved review threads.

The engineering-control evidence packet collects bounded reproduction steps, before/after behavior, acceptance results and rollback planning. It binds every packet to the exact task/revision, opaque source/reference revision, reviewed handoff digest, fixed repository, PR and full base/head commits. Artifacts are identified by SHA-256, not arbitrary URLs; this module does not fetch URLs or accept school uploads. Collection always returns UNVERIFIED. Privacy confirmation is an author acknowledgement, not a content scanner or access grant. Use synthetic, redacted evidence only.

A separate server-injected verifier must retrieve authoritative records and artifact bytes, recompute artifact hashes, verify the current review and complete thread resolution, and produce a receipt bound to the packet digest and all source fields. Browser JSON must never supply the verifier or its receipt. The verifier callback is an internal dependency injection seam, not authentication. No HTTP route exposes it. GitHub numeric identities remain explicitly external identities rather than fabricated PEOS identifiers.

Verification fails closed for stale source/head/task bindings, closed/cancelled cases, unavailable briefs, adapter errors, stale receipts, self review, non-approval, incomplete thread enumeration, open findings, failing/unrun acceptance, absent artifact verification, or unreviewed rollback. Unknown or irreversible data impact requires a future specialist review flow and cannot pass this stage. The verifier receives a detached packet to prevent mutation of the collected record. Errors return generic blockers without leaking upstream details.

Even a passing evidence receipt grants neither founder approval nor execution/release permission. Workflow checks and final readiness remain separate gates. Existing production approval prohibitions and database constraints are unchanged.

Next integration requires append-only engineering evidence storage with actor/request idempotency, fresh PEOS authorization, signed purpose-specific transport, artifact retention/access controls, and a founder evidence editor. GitHub review provenance needs a trusted complete-thread adapter; no new persistent GitHub credential is provisioned by this change. Revalidate task/source/head and the receipt digest at the final decision boundary. Do not represent this foundation as a deployed evidence workflow.
