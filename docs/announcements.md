# Encrypted announcements

The admin announcement form queues encrypted direct messages from the instance's official account. It reports queued, sending, delivered and failed counts. A recipient with no active encryption device stays queued and is retried when their account is ready. Ten unsuccessful delivery attempts produce a failed status; missing-key waits do not expire. Existing announcement history has no recorded delivery progress and is labelled accordingly.

Operators can choose everyone, staff, or selected users. Selected delivery accepts 1–100 unique numeric IDs belonging to existing human accounts. It is also the safe way to test delivery with disposable recipients. Broadcast tests against existing users are not permitted.

The database persists each recipient's delivery state and stable message ID. The worker processes at most 16 ready deliveries per pass and sends at most 4 concurrently. Atomic claims prevent concurrent workers from taking the same ready row. A claim expires after 10 minutes and renews every 30 seconds while its worker runs. After a crash, its stable message ID lets the next worker recognize an already stored message. Claims release database connections before encryption and delivery, so a small connection pool does not deadlock. Delete and delivery tracking serialize against the announcement row; a message that finishes after cancellation is removed.

Attachments have a combined 10 MiB limit, checked while multipart bytes arrive, and at most 2 upload requests are admitted at once. Files use the client's authenticated 64 KiB chunk format and opaque CDN filenames. The durable spool also seals file metadata and ciphertext under a key derived from the official sender's private seed. Original filenames, content types and file keys travel inside the encrypted message. The spool is removed when its announcement is deleted.

## Private files and backups

`E2EE_SYSTEM_KEY_DIR` defaults to `.e2ee-system` beside `CONFIG_PATH`; `ANNOUNCEMENT_SPOOL_DIR` defaults to `.announcement-spool` there. Directories require 0700 permissions; files require 0600 and regular files without symlinks. Both default directories are gitignored. A configured custom directory must also be excluded from source control, logs and public file serving.

Back up the database, system sender seed directory and announcement spool together, with restricted access. Restore them together. The seed also protects spool decryption, and losing it prevents further messages from the existing sender identity. The server refuses to regenerate a seed when that account already has encryption keys: restore the original file instead of resetting identities. Recipient keys are never reset by announcements.

Delivered spools are retained with admin history so deletion and pending-recipient retries remain predictable. Delete an announcement through its endpoint to cancel queued recipients, remove delivered messages and clear its spool. Do not delete spool files while their announcement remains queued; a missing expected spool is a delivery failure, never a text-only fallback. Crash-orphaned files from a failed creation may be removed only after verifying their numeric filename has no corresponding announcement row or active upload.

## Validation

`node --test scripts/tests/system-encryption.test.cjs` exercises actual client HPKE/AES and attachment decryption, signatures, binding, seed recovery refusal and authenticated spool storage. The production PostgreSQL handler/worker suite is opt-in and asserts the isolated `fosscord_codex_admin` database before mutations:

```sh
ANNOUNCEMENT_DELIVERY_TEST=1 DB_POOL_SIZE=1 DOTENV_CONFIG_PATH=/tmp/fosscord-admin-perf/.env node -r dotenv/config -r ./scripts/register-paths.cjs --test scripts/tests/announcement-delivery.postgres.cjs
```

It uses disposable sender/recipient accounts, selected audiences, lease races and tracking-failure injection. Run the full E2EE suite after integration because system DMs use the normal message path. The native selected-recipient smoke passed against the localhost demo: decrypted announcement text and original filename, byte-identical file bytes from the authenticated service worker route, opaque encrypted stored message, one delivered recipient in live admin counts, and zero page errors. All fixture users, channels and announcements were removed afterward. The smoke keeps bigint attachment IDs as strings; numeric JSON IDs lose precision.

[Native recipient screenshot](qa/announcements/native.png) and [admin screenshot](qa/announcements/admin.png) record the run. The text-file preview still showed a placeholder at capture time, so these checks establish delivery, text decryption and original download bytes; they do not establish complete preview layout. Optional image width/height and media duration metadata remain a separate follow-up.
