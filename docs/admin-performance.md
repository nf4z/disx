# Instance administration and performance

Checked locally on 2026-10-04 in a separate PostgreSQL database, with cached Discord client assets and generated development accounts. No production database or deployment was changed.

## Dashboard

Open `/admin/` with an account holding the appropriate instance rights. Existing shop, badges, games, announcements, reports, status, moderation and security controls remain available.

The dashboard now has searchable grouped navigation (Command/Ctrl+K), accessible drawers with focus containment, unsaved-change protection, mobile layouts, and cancellation of obsolete page requests. Profile controls cover usernames, display names, pronouns, bios, uploaded avatars/banners, profile colors, premium state, badges, instance rights, decorations, nameplates, effects and frames. Cosmetic selectors search local packs and render at most 100 matching options while preserving the current selection.

Server controls include artwork, descriptions, locale, verification/content filtering, notifications, premium tier, NSFW/AFK settings and feature flags. Expand “Manage channels and roles” for channel names/topics/categories/slow mode and role names/colors/permission bits. Lists explicitly report truncation above 1,000 resources. Customization retains the existing storefront/catalog editors and adds local profile assignment metadata. Site settings expose user, guild, message and channel limits, default server features, and external-request policy.

The operator-only Performance page reports this process's uptime, memory, event-loop delay, database connectivity, route mean latency, request counts, 5xx errors and rate limiting. These are process-lifetime measurements, not distributed telemetry or per-route percentiles. Overview counts are exact snapshots refreshed every 30 seconds; revision information is fixed at process startup.

## External services

`externalRequests` defaults permit Discord decoration art only. Other Discord asset fallback, runtime client downloads, games, templates, sticker catalogs and bad-domain downloads are disabled. Third-party GIF, IP reputation, forum-spam, Twitter API, OAuth and push integrations require an explicit `thirdParty` opt-in. Configured provider keys alone do not bypass this policy. Local Cap CAPTCHA, local SMTP, local catalogs and cached assets remain usable.

Missing collectibles snapshots no longer trigger GitHub downloads. Unicode reaction colors use the local Twemoji bundle or a deterministic fallback. Discord decoration fetching restricts CDN paths, forbids redirects, deduplicates concurrent work and briefly caches misses. Existing paid catalog prices are converted to free instance-local entitlement behavior; this does not contact Discord checkout or grant a Discord account paid ownership.

Legacy operators who explicitly set `COLLECTIBLES_EXTERNAL_REFRESH=true` and a source URL can still opt into remote catalog refresh. That legacy environment switch is separate from the dashboard policy. Build-time `generate:client` intentionally downloads the requested Discord client; it is not a runtime dependency. User-requested webpage previews, arbitrary application/webhook destinations, configured offload services and code inside cached third-party client/plugin bundles are outside these provider gates. This is not a universal outbound firewall.

## Measured results

A matched overview comparison used 150 GETs per concurrency level, the same account, worktree module paths, database and 100,000-message fixture. Before: seven count queries and two synchronous Git subprocesses per request. After: one shared count refresh per 30 seconds and startup revision lookup.

| Measurement               |          Before |              After |
| ------------------------- | --------------: | -----------------: |
| Concurrency 1 throughput  | 32.9 requests/s |   887.5 requests/s |
| Concurrency 32 throughput | 57.6 requests/s | 1,930.4 requests/s |
| Concurrency 32 p95        |        660.6 ms |            65.5 ms |
| Failed responses          |               0 |                  0 |

The extended run issued 1,000 requests at each of concurrency 1, 8 and 32. Concurrency 32 reached 2,030.8 requests/s, p95 23.8 ms and p99 55.8 ms, with all 3,000 responses HTTP 200. It overlapped browser/encryption verification, so its single-request result is not a matched before/after comparison. These warm local figures are not production capacity claims; users/servers/catalog sizes were small, and the fixture lacks realistic attachments and reactions.

Message relation hydration on 25 rows from the same sparse fixture had median 8.48 ms with joined relations versus 4.43 ms with batched relation queries (five samples). Custom shop serialization regression covers 100,000 items; deletion limits concurrent artwork cleanup to eight. Gateway member tests hydrate at most 1,000 users per page and exercise a real 1,251-member PostgreSQL fixture. SFU tests include concurrency/race checks; media capacity still requires a multi-client load run.

Raw reports: [before](qa/admin-performance/overview-before.json), [matched after](qa/admin-performance/overview-after-comparison.json), [extended](qa/admin-performance/overview-extended.json), [other admin routes](qa/admin-performance/routes.json).

The Vencord asset response now caches compressed bytes with a 16 MiB / 16-entry LRU, two concurrent compression jobs and an 8 MiB input limit. File identity and timestamps invalidate changed assets; oversized or saturated requests retain streaming compression. A matched HTTP benchmark downloaded and consumed the same 253,050-byte Brotli response 100 times at each concurrency level.

| Vencord JavaScript HTTP   |           Before |              After |
| ------------------------- | ---------------: | -----------------: |
| Concurrency 1 throughput  |  71.7 requests/s | 1,260.1 requests/s |
| Concurrency 32 throughput | 238.4 requests/s | 7,647.1 requests/s |
| Concurrency 32 p95        |         141.5 ms |            11.7 ms |
| Failed responses          |                0 |                  0 |

The extended warmed run consumed 1,000 responses at each concurrency level and verified every compressed SHA-256 digest. Concurrency 32 reached 5,261.1 requests/s, p95 7.5 ms and p99 13.0 ms; all 3,000 requests succeeded. This short loopback benchmark measures local asset serving, not page rendering or remote network capacity. Reports: [before](qa/admin-performance/client-assets-before.json), [after](qa/admin-performance/client-assets-after.json), [extended](qa/admin-performance/client-assets-extended.json).

Scheduled messages now claim work atomically with a renewable five-minute PostgreSQL lease, send without reserving a database connection, and acknowledge only their own claim. Delivery failures keep the original row; interrupted sends become eligible after lease expiry. Seven real PostgreSQL checks passed, including delivery with a one-connection pool, concurrent-worker exclusion, expiry recovery, stale acknowledgments and idempotent migration up/down. A crash after publishing but before acknowledgment can still cause a duplicate: this is at-least-once delivery. A separate empty-database migration attempt found a pre-existing missing `templates` table at `templateDeleteCascade1673609867556`; the new lease migration passes independently, but the complete fresh migration chain still needs repair.

## Audit coverage and fixes

Twenty-five specialist review agents covered messages/search, authentication, gateway lifecycle/members/permissions, database indexes, background jobs, CDN/storage, voice, storefronts, optional integrations, client loading, encryption, bots/interactions and OpenAPI discovery. Additional implementation passes followed the reviews.

| Area                 | Previous behavior                                                                        | Current behavior                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Authentication       | repeated JWT setup, expired cached tokens, redundant activity saves                      | signing-secret cache, temporal claims rechecked, conditional activity updates; live account/session/revocation checks retained     |
| Gateway lifecycle    | accumulating shutdown listeners, uncaught malformed frames                               | shared listener cleanup and protocol closes; legacy version alias retained                                                         |
| Permissions          | ghost IPC listeners and stale access after control events                                | idempotent cancellation, ordered revocation/reconciliation, reconnect ownership; ordinary messages add zero DB reads in regression |
| Member chunks        | wide joins and large-guild special-case omissions                                        | bounded ID-first pages and complete role-aware chunks                                                                              |
| Message reads/search | multiplicative joins, repeated interaction lookups, ephemeral count mismatch             | batched relations/users, Map ordering, consistent ephemeral filtering and bounded inputs                                           |
| Read states          | recursive retry on any database error                                                    | conflict-safe inserts in sequential batches of 1,000; unexpected failures propagate                                                |
| CDN                  | incorrect signed-attachment check, broken consumed multipart/raw PUT, synchronous writes | corrected authorization, bounded parsing, awaited atomic asynchronous writes                                                       |
| Shop                 | repeated full-item scans and unlimited artwork deletion                                  | grouped maps, bounded cleanup, generation-safe refreshes and local-first snapshots                                                 |
| Voice                | signaling races, global lock around network work, partial IPC writes                     | bounded ordered signaling, deadlines/cancellation, scoped publication lock, framed writes                                          |
| OAuth consent        | roles projected without permissions/default role                                         | permission projection and one bulk default-role query                                                                              |
| Webhook uploads      | body buffered before token validation                                                    | validate first; 10 files, 25 MiB each and 100 MiB aggregate memory caps, also honoring lower configured limits                     |
| OpenAPI/worktrees    | symlinked dependencies selected original checkout; incomplete route traversal            | aliases anchored to current checkout and nested route discovery                                                                    |

## Remaining work

These are source-review findings, not verified fixes:

- Gateway outbound/replay byte budgets, distributed resume state, bot intents, and lazy member lists beyond 5,000 members.
- Concurrent message last-message/nonce ordering and very short search terms with expensive exact counts.
- Durable scheduled-message publish deduplication, insights computation, bounded startup poll recovery, thread archiver overlap and fair purge scheduling.
- User listing/search indexes and database migration lock cleanup on exceptions.
- CDN cache quotas, streaming large uploads, bounded ffmpeg queues and API-to-CDN upload deadlines.
- SFU subscriber indexing instead of all-peer snapshots, replaced-track reader cancellation and H.264 negotiation compatibility. Microbenchmarks do not settle real audio/video capacity.
- Process-local interaction records/timers prevent reliable horizontal scaling; entity permission resolution remains N+1, and remote HTTP interaction validation needs an end-to-end deadline.
- Encryption backup failure markers, bounded plaintext caches, batching key lookups and negative-cache behavior.
- Atomic Discord client asset publication and failure propagation in the client update/check tools.
- OpenAPI discovery now finds 542 paths and 589 schemas, but still reports five routes without the route middleware, 21 unresolved response schemas and 261 missing response declarations.

The broad dashboard has more coverage, but it does not yet expose every database field or solve every compatibility issue. Add controls deliberately with validation, rights checks, persistence and gateway event verification rather than a raw unrestricted database editor.

## Verification status

The source build, scoped TypeScript lint, generated schemas/OpenAPI, 55 focused JavaScript regressions and 17 compiled TypeScript regressions passed. One PostgreSQL test is skipped by the generic command and passed when explicitly enabled; the separate real-database member/read-state suites passed all seven checks. Six SFU tests passed with `go test -race -count=3`. Dashboard browser checks, API persistence checks, all text-encryption browser checks and the parity probe passed (151 passed, one optional integration skipped).

The stricter voice probe fails: ICE connects and both browsers capture audio, but outbound RTP remains zero. The same result occurred with the pre-change SFU binary, so this run does not establish an SFU regression or working media. The probe now tracks connections even when the client replaces their constructor and exits nonzero unless both users send and receive audio. Voice/DAVE media compatibility remains an open issue; do not treat the older working status as verification of this checkout.

## Reproduce

Use an isolated worktree/database as described in README. Never point the mutation probes at production. The alias preload supports symlinked dependencies.

```sh
npm run build
node --test scripts/dev/cdn-storage.test.cjs scripts/dev/gateway-lifecycle.test.cjs scripts/dev/gateway-permissions.test.cjs scripts/dev/openapi-discovery.test.cjs scripts/tests/*.test.cjs
node -e 'require("dotenv").config({quiet:true}); process.env.MEMBER_REQUEST_DATABASE=process.env.DATABASE; require("./scripts/dev/gateway-members.test.cjs")'
node -e 'require("dotenv").config({quiet:true}); process.env.READ_STATE_DATABASE=process.env.DATABASE; require("./scripts/tests/read-state-performance.test.cjs")'
PORT=3290 node scripts/dev/client-assets-bench.mjs --requests 1000 --output asset-report.json
PORT=3290 node scripts/dev/admin-api-test.mjs
PORT=3290 node scripts/dev/admin-smoke.mjs
PORT=3290 node scripts/dev/admin-bench.mjs --paths /admin --concurrency 1,8,32 --requests 1000 --output report.json
CHROME_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" PORT=3290 node scripts/dev/e2ee-test.mjs
PORT=3290 node scripts/dev/voice-probe.mjs --browser "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
```

The API probe modifies and restores local fixture fields. The browser smoke saves an unchanged profile, verifies dirty-drawer protection and opens the channel editor. Benchmark requests are GET-only. The persistent demo is hosted at `http://localhost:3290/admin/` from `/tmp/fosscord-admin-perf`, managed by launchd service `zip.tiago.fosscord.demo`. Its generated login account is stored in that worktree’s ignored `scripts/dev/.test-account` file.

The browser helpers require Playwright in the existing `~/.cache/fosscord-tools` tool environment.
