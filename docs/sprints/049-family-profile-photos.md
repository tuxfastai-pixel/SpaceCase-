# Sprint 049 — Private child profile photos

Goal: camera/upload entry beside each child, private persisted thumbnail and required-photo readiness messaging. Adult photos remain optional and uncollected.

Failure analysis: public URLs expose children; filenames/EXIF disclose information; stale tabs can attach photos to removed entries; independent object writes orphan media on clear; client-only ownership can expose other families. Therefore use authenticated server-owned identity, strict UUID local child selection, serialized draft revisions, normalized bounded JPEG and transactional deletion.

Implementation: separate owner/child keyed table in family_intake. Maximum five 100 KiB thumbnails per draft, 256px centre-cropped, no EXIF, no original preserved. Existing PostgreSQL credentials only. Bounded small thumbnails are deliberately a pilot exception to media object storage, avoiding public URLs and two-store deletion gaps. Before wider rollout, assess database/backup/egress budgets and migrate behind the same authenticated API to private object storage with transactional retention outbox. No new paid resource or credential activation.

Photo changes save immediately only after details are saved. Mutations advance the same draft revision and record metadata-only SAVE events atomically. Changing profile removes photos of deleted child IDs via trigger; clear removes all photos. Browser blob URLs are revoked. Unverified photos are never facial identity proof or canonical profile changes.

Scope: JPEG/PNG/WebP camera/file input, preview, replace, explicit removal, error states, review required-photo message. Drafts remain saveable without photos. Actual school submission remains disabled; its future server contract must enforce required photos. No correspondence recipient sees draft photos, no school/Atlas/AI transfer, no parent grants, no face recognition.

Release gate: migration 0017 isolated branch test, CI including PostgreSQL tests, browser responsive checks and explicit production approval. Existing deployed API requires this migration before releasing the changed draft query. No migration or production release applied by this build.
