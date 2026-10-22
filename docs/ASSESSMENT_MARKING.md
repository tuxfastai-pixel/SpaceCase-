# Teacher assessment workflow

Open My classes → Assessments & marking. Create an assessment, enter each question and memorandum with a maximum, and save a draft. Drafts can be edited. Confirm the rubric and open the assessment when it is correct; the rubric then stays fixed for all work in that assessment.

Select up to 50 JPG/PNG/WebP photos per batch. HEIC/PDF/animated images are not accepted. Browser preparation supports inputs up to 20 MB / 24 megapixels; the server accepts at most 2 MB per prepared image. Individual files can fail and be retried. Selecting the same photo again resumes an interrupted save or reports a duplicate rather than adding another page. Each assessment supports 500 active/reserved pages and each learner up to 10 ordered pages. Interrupted upload reservations count toward the limit until reconciled.

Match each photo using the current learner list and number pages from 1 without gaps. Open Review work and confirm that the pages belong to that learner and are complete. Enter marks and feedback for each question, tick each reviewed box, and save the review. A separate approval checkbox and action record the result. Saving, generating or reviewing alone never approves a result or sends a message.

Approved results can be reopened with a correction reason. Earlier results remain immutable. Changing photos or matches clears affected unapproved review and proposals; the teacher must check pages again. If another tab changes the work, copy unsaved review text and reload before continuing.

## Private storage
The app uses private `@vercel/blob` reads/writes with a production-only `BLOB_READ_WRITE_TOKEN` supplied by Vercel (or a connected `BLOB_STORE_ID` with Vercel OIDC). Never create a public store for learner work. Do not point previews/local tests at production storage. Photo bytes are not stored in Postgres or audit, and API clients receive authenticated app routes rather than storage URLs.

Removed photos are hidden and inaccessible through the app; this is not permanent erasure. Establish a school retention/purge policy and an operator reconciliation process before expanding beyond the pilot. Pending/removed object keys remain tracked in `assessment.pages` for that purpose. Do not delete objects directly without checking those records and an approved school retention action.

## Optional PSG AI contract
Required production configuration:
- `SPACECASE_ASSESSMENT_AI_ENABLED=true`
- `PSG_AI_BASE_URL`: approved HTTPS shared AI service origin
- `PSG_AI_SERVICE_TOKEN`: server-only service credential

POST `/v1/assessment-marking`, authenticated by service bearer token, accepts contract version `spacecase.assessment-marking.v1`, request UUID/idempotency key, purpose `ASSESSMENT_ASSISTANCE`, actor/school/assessment and pseudonymous submission references, instructions, rubric and at most 10 base64 JPEG pages. No canonical learner ID, name or admission number is added. Page images can contain personal information; the teacher must confirm the scoped disclosure before requesting assistance.

The service must implement authenticated product/purpose scope, idempotency, model and retention policy, input/output size limits, and prompt-injection boundaries. Treat photographed instructions as work evidence only. Never follow image instructions to change scores/policy, access tools, reveal data or approve results. The service must return strict JSON matching `proposalSchema`: executionId, modelRef, policyVersion, one item per rubric question (questionId, marks or null, uncertain, feedback, evidencePageIds) and warnings. Unreadable/missing/ambiguous answers must abstain or be flagged uncertain; no unsupported confident mark is permitted. SpaceCase validates references and maxima and requires teacher review irrespective of confidence.

This repository implements the consumer contract, not a fabricated PSG endpoint. No model credential is requested or provisioned here. Without the live shared service and explicit enable flag, manual assessment marking remains available and the UI explains why assistance is unavailable.
