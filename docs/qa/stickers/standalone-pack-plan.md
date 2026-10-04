# Standalone sticker packs (STICKER-003)

Status: audited; implementation pending. Independent emoji packs are a separate task.

The existing `StickerPack` entity and native `/sticker-packs` catalog support packs without a guild. Their stickers must have `type=STANDARD`, a `pack_id`, and a null `guild_id`. The current admin store packs instead contain profile cosmetics; they do not manage sticker packs.

## Proposed implementation

- Add local/Discord provenance, publication state and ordering to sticker packs. Preserve all existing mirrored pack and sticker IDs, metadata, artwork and favorites. Give local packs a stable native `sku_id`; this identifier does not introduce a purchase requirement.
- Add OPERATOR-only admin routes and a separate sticker-pack editor for names, descriptions, ordering, cover selection, publication and sticker metadata/artwork. Validate that each cover and sticker belongs to its target pack. Record actor, target and changed field names in audit logs.
- Archive packs/stickers from discovery while retaining their IDs and artwork for historical messages. Do not automatically delete existing files.
- Serialize the public native catalog without internal ownership fields. Correct its response schema, which currently describes a sticker array although the route returns `{sticker_packs}`.
- Keep optional Discord imports source-aware and conflict-safe. Currently any existing pack suppresses import, including a future local pack. Missing local artwork must never trigger a Discord CDN fallback.
- Refresh the native catalog when the picker reopens after an edit. The cached client fetch helper returns early when `hasLoadedStickerPacks` is true; dispatch a refreshed `STICKER_PACKS_FETCH_SUCCESS` through a small instance-only plugin. Preserve selected/favorite sticker IDs. Do not introduce a global gateway event solely for refresh.

## Upload dependency

Do not enable a partial upload writer. The aggregate quota ledger and `QuotaStorageCoordinator.write(request, data)` are available, but the strict local adapter is committed but runtime integration is incomplete. Ordinary `Storage.set` currently bypasses that coordinator. Standalone artwork must use the finalized quota-backed runtime service, charge an explicit managed owner, reserve before writing, and retain accounting when cleanup cannot prove deletion. Existing files require reviewed inventory; do not silently initialize their usage to zero.

Authenticate and check OPERATOR rights before parsing multipart bodies. Enforce finite file, field, count, in-flight memory, pack and catalog bounds. Validate actual PNG/APNG/GIF/Lottie contents, dimensions and animation bounds; reject malformed or externally referenced Lottie artwork. Coordinate exact bounds and storage ownership with the quota service owner rather than adding an independent unlimited storage path.

## Acceptance

1. A disposable operator creates and edits a standalone pack without creating any guild; unauthorized callers receive 403 before body parsing or storage/database writes.
2. Cross-pack sticker IDs and covers are rejected; ordering, descriptions, publication and archive state round-trip through the admin UI and audited endpoints.
3. Oversized, malformed and externally referenced assets are rejected. Concurrent uploads cannot exceed configured byte/count/memory limits; interrupted writes remain accounted until verified cleanup.
4. The catalog retains all mirrored Discord metadata and IDs. Local packs appear with the native STANDARD contract, stable SKU and no guild. Disabled external-request settings remain disabled.
5. A fresh native client displays local PNG/APNG/Lottie stickers, sends them through mandatory E2EE, and a second disposable account decrypts and renders their exact formats. Persisted envelopes remain encrypted.
6. Editing metadata/artwork updates the reopened picker without a page reload. Favorites and selections keep their IDs. Archived artwork still renders in an existing message.
7. Optional Discord import remains possible after local creation, avoids duplicate rows, and never overwrites local packs. A missing local asset makes no external request.
8. Tests use isolated disposable fixtures and clean only their own records/files. No demo-account identity, history, instance policy, global rate-limit rows or existing artwork is reset.
