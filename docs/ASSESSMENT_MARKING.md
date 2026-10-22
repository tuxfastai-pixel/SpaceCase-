# Teacher assessment workflow

Open My classes → Assessments & marking. Create an assessment, enter each question and memorandum with a maximum, and save a draft. Drafts can be edited. Confirm the rubric and open the assessment when it is correct; the rubric then stays fixed for all work in that assessment.

Select up to 50 JPG/PNG/WebP photos per batch. HEIC/PDF/animated images are not accepted. Browser preparation supports inputs up to 20 MB / 24 megapixels; the server accepts at most 2 MB per prepared image. Individual files can fail and be retried. Selecting the same photo again resumes an interrupted save or reports a duplicate rather than adding another page. Each assessment supports 500 active/reserved pages and each learner up to 10 ordered pages. Interrupted upload reservations count toward the limit until reconciled.

Match each photo using the current learner list and number pages from 1 without gaps. Open Review work and confirm that the pages belong to that learner and are complete. Enter marks and feedback for each question, tick each reviewed box, and save the review. A separate approval checkbox and action record the result. Saving, generating or reviewing alone never approves a result or sends a message.

Approved results can be reopened with a correction reason. Earlier results remain immutable. Changing photos or matches clears affected unapproved review and proposals; the teacher must check pages again. If another tab changes the work, copy unsaved review text and reload before continuing.

## Private storage
The app uses private `@vercel/blob` reads/writes with a production-only `BLOB_READ_WRITE_TOKEN` supplied by Vercel (or a connected `BLOB_STORE_ID` with Vercel OIDC). Never create a public store for learner work. Do not point previews/local tests at production storage. Photo bytes are not stored in Postgres or audit, and API clients receive authenticated app routes rather than storage URLs.

Removed photos are hidden and inaccessible through the app; this is not permanent erasure. Establish a school retention/purge policy and an operator reconciliation process before expanding beyond the pilot. Pending/removed object keys remain tracked in `assessment.pages` for that purpose. Do not delete objects directly without checking those records and an approved school retention action.

## Photo reading and vision marking
Request photo reading first; the reader receives no memorandum. Inspect/correct every page's extracted text, keep unresolved words flagged, tick each page review, and save it. Mark proposals then receive the reviewed reading, original photos and rubric. A page still flagged unclear cannot support a confident numeric proposal. Manual marking remains independent.

Basic upload warnings measure image dimensions and overall contrast. They do not certify handwriting readability or detect every crop, glare or blur problem. Original normalized photos are preserved. Earlier uploads without quality metadata are not retroactively labelled clear.

The current shared contract is `spacecase.assessment-vision.v2`, with separate `/v1/assessment-reading` and `/v1/assessment-marking` routes. Images in one AI request total at most 2 MB and the entire serialized envelope at most 4 MB. Oversized sets need smaller/fewer clear photos or manual marking; the system does not silently discard pages or shrink evidence further.

The separately deployable PSG execution workspace is `services/psg-ai`; see its README for configuration and activation gates. SpaceCase needs its HTTPS origin in `PSG_AI_BASE_URL`, the shared server-only `PSG_AI_SERVICE_TOKEN`, an explicit enable flag, and an integer rolling call cap. Both the service execution flag and product enable flag default off; the model has no default. No live AI execution is claimed by code tests.

A one-use permit must match an existing current READ/MARK job before the shared service can call a provider. A duplicate claim does not call a model again. The configured call cap is not a dollar spending cap. Migration 0013, both tested source deployments and an approved synthetic/model/budget/retention pilot precede real learner-work activation. See `docs/adr/0011-vision-reading-service.md` for the ownership boundary. A signed-in teacher walkthrough remains an acceptance step after release.
