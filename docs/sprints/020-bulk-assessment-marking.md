# Assessment work upload and marking

Goal: a real class assessment workflow from a teacher-written rubric to saved, reviewed and approved marks.

Delivered scope:
- private assessment list, draft editing and explicit rubric lock;
- questions, memorandum, accepted answers and maxima, up to 50 questions / 1,000 marks;
- up to 50 photos selected per upload batch, per-file progress and retry;
- safe server image decoding, metadata removal, bounded private storage, duplicate suppression and resumable reservations;
- explicit current-learner matching, page order and teacher confirmation;
- manual marks and feedback for every question;
- optional versioned PSG marking proposal adapter, uncertainty and evidence validation;
- saved reviewed marks followed by separate teacher approval;
- approved result overview and audited reopening for correction;
- owner/class/learner boundaries, revision conflict checks, and immutable approved result history.

Out of scope: automatic handwriting-based identity matching, externally sent reports, curriculum alignment, OCR certainty guarantees, automatic final marks, direct model-provider credentials, other teacher-tool roadmap items, parent messaging, cross-product learner profiles, automatic permanent photo purge, a production-scale capacity claim.

Failure analysis: mismatched/removed learners, forged identifiers, malformed images, retry after uncertain network outcome, duplicate upload, missing page sequence, overwrite races, model hallucination or prompt injection, revoked authority during a model run, review overwritten by delayed generation, and forged approval with client-supplied scores. Boundary tests and database tests cover these cases; production does not receive synthetic learner work.

Acceptance: an assigned teacher creates/edits a rubric, opens it, uploads/retries a batch, matches and confirms pages, manually reviews every question and approves the result. Another account/class cannot read photos. Removing a page or rematching invalidates draft review. Approved results require an explicit correction reason before editing. Unsigned/cross-origin operations are rejected. Invalid AI proposals and stale runs never create approved marks.

Release sequence: apply migration `0012_assessment_workflow.sql`, record its checksum in the migration ledger, release the tested application commit, verify readiness and unsigned API/photo boundaries. Reverting application code leaves additive tables and records intact. Private Blob storage is already provisioned; runtime readiness checks the required database tables. A signed-in teacher must still verify real upload/marking UX after release.

AI activation is a separate configuration gate. The app remains usable for manual marking while `SPACECASE_ASSESSMENT_AI_ENABLED` is unset/false. Enable only when a working approved PSG service implements the contract and retention/model policy. No live AI assessment execution is claimed by this release.
