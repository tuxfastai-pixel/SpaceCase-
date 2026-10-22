# Sprint 026 — Engineering runner preflight foundation

Implemented: a server-side pure preflight policy that reconstructs the canonical reviewed handoff, verifies its SHA-256 digest and current open-ticket revision, requires founder authority and binds the plan to a full base commit SHA. Policy-owned roles and requirements cannot be replaced by a copied document. The resulting plan is explicitly blocked, with no repository, model, deployment or email permission. It describes a fresh synthetic-only environment, denied network, bounded runtime/memory/output and a single attempt.

This is a tested policy foundation, not a runner or durable task ledger. It has no route, persistence, scheduling, shell execution or sandbox provisioning. Its context must be supplied by freshly resolved server authority and a current ticket query; callers must never accept it from a request body. The eventual runner must enforce limits independently, fetch the selected repository commit using its own scoped adapter, and record failures without executing brief text as shell instructions.

Remaining: PSG-owned durable task storage and idempotent claims, authenticated SpaceCase adapter, isolated execution provider, repository-scoped credentials, evidence retention, cancellation and lease expiry. Independent review, founder approval and a separate release gate remain required. No inference budget or provider is activated by this change. See ADR 0014.

Validation: synthetic unit tests cover commit/digest/source binding, non-founder denial, closed/stale source rejection, policy tampering and unexpected permission fields. Database and actual sandbox behavior are not exercised because neither is connected here.
