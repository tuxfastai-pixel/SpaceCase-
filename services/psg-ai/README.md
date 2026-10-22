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
