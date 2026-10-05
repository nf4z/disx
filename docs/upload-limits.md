# Attachment upload limits

Upload-slot creation requires both `VIEW_CHANNEL` and `ATTACH_FILES` through the canonical permission resolver. Knowing a private DM's channel ID does not grant upload access; guild channel overwrites also apply.

The API rejects negative, fractional and oversized file sizes, invalid IDs and empty or invalid sanitized filenames. Each batch contains between one file and the smaller of `limits.message.maxAttachments` and 100 files.

A transaction locks the uploading user's row before checking and creating reservations. Per user, the limits are:

| Scope                                                   | Count | Bytes                                       |
| ------------------------------------------------------- | ----- | ------------------------------------------- |
| Pending cloud uploads (`size IS NULL`)                  | 32    | Larger of `cdn.maxAttachmentSize` and 1 GiB |
| All retained cloud uploads, including completed uploads | 512   | Larger of `cdn.maxAttachmentSize` and 2 GiB |

Retained bytes use the larger of the declared and actual size for each cloud upload. Completing a PUT frees its pending reservation but does not remove the upload from the retained limits. Exceeding a limit returns HTTP 429 with `Too many pending uploads. Finish or cancel an upload first.` Existing uploads are preserved. A user already over a retained limit must remove unused uploads before creating more; finishing another upload does not free retained capacity.

The CDN checks internal POST signatures and exact cloud-upload reservations before parsing request bodies. Cloud PUTs are capped by the reserved file size, including chunked and multipart uploads. Before writing, a transaction locks and rechecks the reservation so a slot deleted after initial authorization cannot produce a late orphan write. Multipart metadata is bounded separately. Cloud capability paths are no longer written to clone/delete logs.

## Verification

`scripts/tests/cdn-upload-authorization.test.cjs` checks real HTTP requests with bodies withheld to prove early rejection, chunked and multipart size enforcement, valid writes, deleted reservations and zero-byte raw uploads. `scripts/tests/attachment-upload-quota.postgres.cjs` uses disposable records in `larpcord_codex_admin` to verify malformed declarations, DM outsiders, guild overwrites, concurrent reservations and pending/retained count and byte limits. The full native encryption suite also passed against the refreshed demo.

## Remaining storage work

These limits bound cloud upload staging. They do not impose an aggregate quota on posted attachments, cloned objects, reused attachments, other CDN object families or bytes left behind by failed deletion. Posting an attachment currently clones its cloud object and retains the original. Account and instance quotas need atomic accounting for every physical write and clone, reconciliation of existing objects, and capacity release only after successful deletion. Existing objects must not be automatically removed when adding that accounting.
