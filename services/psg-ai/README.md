# PSG assessment vision service

Independent PSG-owned execution workspace. It shares a versioned protocol with SpaceCase, not its product database or learner records. Source lives alongside the first consumer to keep contract validation and CI review together; deployment, credentials and execution policy are separate.

Routes:
- GET `/health`: liveness and whether execution is enabled; no credentials/data.
- POST `/v1/assessment-reading`: confirmed photos → raw page transcription/uncertainty; no memorandum accepted.
- POST `/v1/assessment-marking`: photos + checked transcription + fixed rubric → draft marks/evidence/uncertainty.

Configuration:
- `PSG_AI_SERVICE_TOKEN`: 32+ character server-to-server secret shared only with the product.
- `PSG_PRODUCT_BASE_URL`: fixed HTTPS SpaceCase origin for one-use execution claims; never accepted from request input.
- `PSG_AI_EXECUTION_ENABLED`: defaults false. Keep false until an approved pilot.
- `PSG_AI_MODEL`: explicitly approved ID from the current Gateway model catalog. No default is hard-coded.
- `VERCEL_OIDC_TOKEN` supplied by the service deployment, or an approved `AI_GATEWAY_API_KEY`. No provider-specific key.

SpaceCase additionally needs `PSG_AI_BASE_URL`, matching `PSG_AI_SERVICE_TOKEN`, `SPACECASE_ASSESSMENT_AI_ENABLED=true`, and integer `SPACECASE_ASSESSMENT_AI_DAILY_LIMIT` from 1–100. The cap covers successful one-use claims across rolling 24 hours for both reading and marking. Zero/unset disables execution. A value of 10 permits at most five complete read+mark pairs, fewer if attempts fail or a teacher repeats a step. It is not a USD spending cap.

Use a separate Vercel project with root directory `services/psg-ai`, include source outside the root for `contracts/assessmentVision.ts`, install from the root npm workspace lock, and build this workspace. Do not copy SpaceCase database/Blob/Auth environment variables into the service. Preview executions remain disabled and must not call production claim endpoints with active credentials.

Every provider call has no tools, no automatic retries/fallback models, fixed bounded output, a per-request ZDR/no-training requirement and validated current model capability/retention metadata. If Gateway policy or plan eligibility is missing, the request fails. Do not remove those guards to make an activation work. No automatic model substitution or paid account provisioning is performed.

Check current API docs and model metadata before choosing a pilot model:
- https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/structured-outputs
- https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/images
- https://vercel.com/docs/ai-gateway/security-and-compliance/zdr
- https://ai-gateway.vercel.sh/v1/models

Tests use synthetic payloads and mocked network calls, not live inference. Before real learner work, obtain an approved model, plan/retention scope and explicit inference budget; evaluate synthetic examples across handwriting, language, diagrams, rotations and unreadable/blank pages. Record transcription errors, abstention, evidence accuracy and mark deviations rather than claiming a generic accuracy percentage.

## Engineering ledger (internal foundation, disconnected)

`lib/engineering/ledger.ts` implements durable blocked tasks and cancellation. It has no HTTP route or UI connection and grants no execution. Store only founder-reviewed synthetic briefs when an authenticated adapter is added; never pass original tickets or school records. The Stage 1 founder preview is still ephemeral.

Use a dedicated engineering PostgreSQL database, separate from SpaceCase/PEOS, with a non-owner `psg_engineering_runtime` role (NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE). The migration owner runs `npm run db:migrate --workspace=psg-ai` with the direct connection `PSG_ENGINEERING_DATABASE_URL_UNPOOLED`; the runner rejects pooler hosts, known product schemas and unsafe runtime roles. It maintains its own checksummed migration history. No production connection is configured by this change. A future adapter should use a separate pooled runtime credential and must never expose migration credentials to workers.

Integration tests use only `PSG_ENGINEERING_TEST_DATABASE_URL`, pointing to a disposable dedicated database; they apply the migration and exercise a restricted runtime role. Do not set this test variable to production. CI provisions this database independently from the product test database. Before activating storage, define reviewed-brief retention and owner-operated purging (runtime has no DELETE privilege), and authenticate/revalidate source authority on every task action. Worker claims and execution remain unimplemented.

## Authenticated engineering save adapter (disabled)

POST `/v1/engineering/tasks` verifies a bounded `{"attestation":"payload.signature"}` envelope using a pinned Ed25519 public key before storage. This authorizes only saving a BLOCKED task, never running it. The signed request binds the project, exact base commit, reviewed brief digest, actor and request UUID, with a 30-second expiry. It is an issuance-time source/authority snapshot; future execution must revalidate both. Replay is idempotent and cancelled work stays cancelled.

PSG production configuration: `VERCEL_ENV=production` (platform supplied), `PSG_ENGINEERING_LEDGER_ENABLED=true`, `PSG_ENGINEERING_SIGNING_PUBLIC_KEY` (PEM public key only), and `PSG_ENGINEERING_DATABASE_URL` (pooled restricted runtime credential for the separate engineering database). Migration credentials remain separate. Preview deployments are always disabled.

SpaceCase production configuration: `SPACECASE_ENGINEERING_LEDGER_ENABLED=true`, `PSG_ENGINEERING_BASE_URL` (fixed HTTPS service origin), `SPACECASE_ENGINEERING_SIGNING_PRIVATE_KEY` (Ed25519 PKCS8 PEM, server-only secret). Never put this private key in PSG, a browser/public variable, repository or log. Do not reuse assessment credentials or forward founder login credentials. Key installation is not performed by this change.

The founder API action `SAVE_ENGINEERING_TASK` accepts the existing reviewed handoff input plus `requestId`, full 40-hex `baseCommit` and `consentToStore=true`. It resolves fresh founder authority and ticket revision before signing. On timeout/unknown outcome, retry the identical request UUID and body. Redirects fail. The returned task must match the submitted source/revision/digest/commit. No frontend save UI is introduced; keep both flags disabled until dedicated storage, retention/purge policy and explicit consent UI are ready. Existing handoff previews remain ephemeral.
