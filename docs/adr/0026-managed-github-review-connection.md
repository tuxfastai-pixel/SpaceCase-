# ADR 0026 — Managed read-only GitHub review connection

The deployed PSG engineering verifier needs authenticated GraphQL to establish inline review-thread resolution. ChatGPT's GitHub connection cannot supply runtime credentials, and storing a permanent personal token would unnecessarily extend credential lifetime.

Use `@vercel/connect` 2.5.5 in the PSG service only. The dedicated `github/spacecase-review-verifier` App has metadata and pull-request read access, installation `174457593` on `tuxfastai-pixel`, selected repository `SpaceCase-`, and no triggers. Provider scopes are not exposed in this connector's setup; the installed App's permissions define access. Vercel keeps the App credential; the runtime exchanges its project OIDC identity for a short-lived installation token. No key or token enters source control, product requests, logs or responses.

Activation requires `PSG_ENGINEERING_GITHUB_CONNECT_ENABLED=true`, the PSG service project ID and production environment. Pin connector UID, installation and tenant in server code, validate returned metadata and expiry, and request a fresh grant for each verification. Reuse that credential only for the two GraphQL reads in that verification. Public REST reads remain unauthenticated. Acquire credentials lazily after packet/head checks, only when inline comments exist. Token exchange shares the verifier's deadline; unavailable, revoked, mismatched or expired credentials block approval. No fallback to a permanent token is used by the service wrapper.

This adds no write operation, trigger, agent execution, inference or deployment permission. PEOS founder/source authorization and all existing evidence, exact-head, independent review, reproduction and rollback requirements remain in force. The connection is not evidence by itself.

Production attachment is a separate access grant. Automatic approval review rejected attaching this connector to the PSG production project without specific authorization. Prepare and test the code first; obtain that authorization before attaching, setting activation and deploying. The setup UI currently shows a SpaceCase project connection across production/preview/development; this build does not use it. Review removal of that unnecessary attachment separately rather than silently changing user-created access.

Rollback: disable the activation flag and detach the PSG project connection. Inline comments then remain unverified and approval is blocked. Preserve existing audit records; no database migration is required.

Reference: https://vercel.com/docs/connect/ts-sdk-reference (checked 23 October 2026).
