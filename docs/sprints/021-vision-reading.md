# Photo reading and reviewed vision marking

Goal: add inspectable image-quality and reading stages, with a real separately deployable PSG AI execution implementation.

Scope: low-resolution/contrast warnings; raw per-page vision transcription; explicit teacher correction/review; separate READ and MARK modes; exact page/question validation; uncertainty abstention; one-use execution permits; per-actor and global count limits; independent authenticated PSG service and guarded Vercel AI Gateway calls.

Out of scope: automatic identity recognition, clinical inference, certainty guarantees, measured OCR/marking accuracy, automatic approved grades, live learner-data/provider transfer without activation, paid account changes, automatic retention purge, all remaining teacher tools.

Failure cases: repaired/invented handwriting, model answers biased by seeing the memorandum during reading, fabricated page IDs, uncertain-page marks, stale transcription after page changes, duplicate model execution, revoked authority, oversized multimodal requests and provider truncation. The reader has no memorandum. Checked transcription must match every current page; ambiguous words stay flagged. Provider JSON is schema-checked and incomplete generations fail rather than entering review as complete work.

Acceptance: an assigned teacher can inspect upload quality warnings, request a reading when activated, compare/correct each page transcription, save explicit page reviews, and then request a marking proposal. Uncertain evidence abstains. Manual marking remains available. Every page change invalidates transcription/review/proposals. A duplicate service claim or exceeded cap prevents provider calls. Cross-school/person/mode/hash/revision claims fail. No AI-generated grade can approve itself.

Validation: contract/image/HTTP tests, database workflow and concurrent permit-cap tests, standalone service tests with network doubles, typecheck/lint and both production builds. Real photo/handwriting accuracy and provider eligibility require a separately approved synthetic pilot; no live inference is claimed from tests.

Release: migration 0013 first, then tested app/service source. PSG service can be deployed with execution disabled. Production AI flags, model and rolling call cap stay disabled/unset until activation is approved. Rollback app/service code while keeping additive records and zero execution cap.
