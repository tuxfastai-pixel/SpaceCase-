# Sprint 051 — Short child medical information

Goal: optional short medical/care statement beside each child in Your children.

Failure analysis: existing drafts lack the field; adding it as required would break reload. Health data must not enter URLs, metadata audit, public avatars, logs, readiness requirements, AI or future school payloads by accident. Blank means not provided, never an inferred healthy state. No diagnosis or treatment recommendations.

Implementation: medicalInformation string, trimmed and bounded to 300 characters with existing unsupported-control validation; schema defaults to empty string when absent. Explicit empty value for newly added children. A labelled three-row textarea, character count, examples and privacy/urgent-contact explanation. Owner-only review uses a collapsed disclosure. Existing draft save/reload and clear lifecycle apply. No new table, role, credential or permission. No school sharing or medical document upload.

Acceptance: legacy draft parses; blank valid; bounded text round-trips; oversized/control payload rejected; notes remain out of metadata audit and readiness. Existing family HTTP authorization, owner isolation and optimistic revisions remain enforced. Medical notes are optional and must never block draft completeness.

Validation: contract regression, database round-trip/audit assertions, typecheck/lint, CI and synthetic UI review. No real medical data used in testing.

Future school sharing needs explicit purpose, parent acknowledgement, authorized staff scope and audit. Do not automatically include medical notes in general correspondence, child icon or AI marking requests.
