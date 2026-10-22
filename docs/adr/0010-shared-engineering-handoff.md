# ADR 0010 — Shared engineering handoff, before autonomous execution

Decision: extend the existing support workflow with a founder-reviewed, versioned engineering contract, beginning with SpaceCase. Do not copy Paperclip or introduce a new identity system. Reuse PEOS authority, SpaceCase ticket revision/ownership and existing founder recommendations. The shared package under packages/engineering-control is the initial portable boundary; it may later be extracted for the PSG AI Platform and other repositories. PEOS and VA-Beta are registry entries only, explicitly disconnected, not usable integrations.

Failure analysis: sending arbitrary ticket narratives to agents could disclose learner information or treat a complaint as a tool instruction. A support staff role cannot become an AI credential. A planning document cannot grant permissions, approve spending or prove a test passed. A founder approval for a proposal is not deployment permission for an unrelated commit.

Stage 1: the founder rewrites an open ticket into a synthetic reproduction brief and explicitly attests to privacy review. Original title, narrative, school and reporter details never enter the shared contract. This is human review, not automatic redaction. The server binds preparation to the current ticket revision under a row lock and audits the contract version, source revision and SHA-256 digest without storing brief content in audit metadata. Editing the brief or refreshing to a new ticket revision clears the preview. The brief is ephemeral; the UI offers explicit copy and says it is not saved. Copy is not dispatch.

The contract specifies investigator → engineer → independent reviewer → principal engineer → founder responsibilities, evidence requirements, project binding and default-deny execution. Source data remains untrusted. No model calls, runner, background jobs, external handoff, repository writes, role grants, emails, billing changes or deployments are introduced. Work products and approvals continue to use the existing manual recommendation flow.

Progressive rollout:
1. Reviewed handoff and policy tests (this change).
2. Durable shared task ledger and isolated runner: fresh authority, revision/digest validation, scoped repository credentials, synthetic-data sandbox, idempotent claims, resource limits and observable failure. Confirm provider/budget before model execution.
3. Independent code review, exact-commit validation and founder approval; separate controlled release gate and rollback verification.
4. Add PEOS and VA-Beta adapters after individual access/contract review. Keep product data and canonical roles in their current owners.

No schema migration or new runtime dependency is needed for stage 1. Never market handoff preparation as autonomous investigation, scheduling or self-healing. Review hard enforcement in each runner before enabling it; prompt text is not an access-control boundary.
