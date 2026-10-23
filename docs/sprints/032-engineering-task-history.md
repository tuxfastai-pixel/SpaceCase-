# Sprint 032 — Founder engineering audit timeline

Goal: let the founder inspect the recorded lifecycle of saved engineering work.
Scope: source-bound signed metadata reads, latest-25 audit projection, on-demand accessible timeline and explicit refresh, retention/cancellation visibility.
Out of scope: saved brief retrieval, actor identities, editing history, agent execution, paid AI, new credentials and migrations.
Acceptance: valid founder/source/task reads return newest recorded events; wrong sources and unknown tasks are unavailable; brief removal preserves history; cross-origin/non-founder requests and injected fields fail. Responses reveal no actor identifiers or brief content. UI can open/hide/refresh and reload after task revision changes without polling.
Security: fresh PEOS founder authority, purpose-bound thirty-second Ed25519 attestations, strict response binding, no-store, bounded result and transaction timeouts.
Validation: transport and product authority/acknowledgement tests, PostgreSQL lifecycle/privacy integration checks in CI, responsive synthetic browser walkthrough, both typechecks/builds and lint.
Documentation: ADR 0020 and this closeout record describe the read projection and limits.
