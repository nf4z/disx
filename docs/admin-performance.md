# Instance administration and performance

Checked locally on 2026-10-04 in a separate PostgreSQL database, with cached Discord client assets and generated development accounts. No production database or deployment was changed.

## Dashboard

Open `/admin/` with an account holding the appropriate instance rights. Existing shop, badges, games, announcements, reports, status, moderation and security controls remain available.

The dashboard now has searchable grouped navigation (Command/Ctrl+K), accessible drawers with focus containment, unsaved-change protection, mobile layouts, and cancellation of obsolete page requests. Profile controls cover usernames, display names, pronouns, bios, uploaded avatars/banners, profile colors, premium state, badges, instance rights, decorations, nameplates, effects and frames. Cosmetic selectors search local packs and render at most 100 matching options while preserving the current selection. The compact catalog response is serialized once per snapshot and supports private conditional ETags. Live upload/create, rename and delete checks verify immediate invalidation and cleanup; 100 warm requests over 1,477 cosmetics all returned HTTP 200, with p95 2.7 ms and identical response hashes.

Server controls include artwork, descriptions, locale, verification/content filtering, notifications, premium tier, NSFW/AFK settings and feature flags. Expand “Manage channels and roles” for channel names/topics/categories/slow mode and role names/colors/permission bits. Lists explicitly report truncation above 1,000 resources. Customization retains the existing storefront/catalog editors and adds local profile assignment metadata. Site settings expose user, guild, message and channel limits, default server features, and external-request policy.

The next dashboard pass adds these controls. Browser checks exercised saving, artwork uploads, reset, dirty-change protection and refreshed resource lists on desktop and at 390 pixels wide.

| Before                                                   | After                                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mirrored packs could only be hidden                      | Edit local names, summaries, order, banners and logos; restore vendor defaults while retaining visibility       |
| Custom items lacked ordering and pack movement controls  | Edit item position or move it to another custom pack while retaining IDs, artwork and settings                  |
| Channel and role controls only edited existing resources | Create categories, text/voice/community channel types and roles, with validated permissions and instance limits |
| Rapid saves accumulated notifications over controls      | At most three notifications, with pointer events passing through                                                |
| Finishing a save could reopen a drawer after closing it  | Detached or closed editors stop their asynchronous navigation                                                   |

Mirrored pack customization overlays the local catalog and leaves vendor item metadata intact. Uploaded artwork is served locally. Profile changes now notify observers through the public user projection as well as updating the account's own private state; a live friend profile received and displayed its changed banner.

Inspected browser captures: [desktop resources](qa/admin-performance/admin-resources-desktop.png), [mobile resources](qa/admin-performance/admin-resources-mobile.png). Benchmark reports: [user indexes](qa/admin-performance/admin-users-indexes.json), [catalog before](qa/admin-performance/collectibles-search-before.json), [catalog after](qa/admin-performance/collectibles-search-after.json).

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

Scheduled messages now claim work atomically with a renewable five-minute PostgreSQL lease, send without reserving a database connection, and acknowledge only their own claim. Delivery failures keep the original row; interrupted sends become eligible after lease expiry. Seven real PostgreSQL checks passed, including delivery with a one-connection pool, concurrent-worker exclusion, expiry recovery, stale acknowledgments and idempotent migration up/down. A crash after publishing but before acknowledgment can still cause a duplicate: this is at-least-once delivery. The real fresh-database initialization path also passed: initial schema plus all 148 migrations, with zero migrations reapplied on the repeat run. An earlier standalone test failed because it omitted the initial schema; no migration repair was needed.

Additional database and catalog measurements use disposable fixtures or bounded handler runs. These measure SQL/handler work, not HTTP throughput or production capacity.

| Measurement                                                   |                 Before |               After |
| ------------------------------------------------------------- | ---------------------: | ------------------: |
| Admin user list, 100,000 users                                |              11.348 ms |            0.013 ms |
| Admin username substring count, 100,000 users                 |              86.991 ms |            0.068 ms |
| Permission resolution, median over 35 checks                  |    4.19 ms / 5 queries | 2.11 ms / 3 queries |
| Own profile, median over 50 warm handler calls                |    2.11 ms / 6 queries | 1.08 ms / 2 queries |
| Shop browse, 100,000 cosmetics, warm                          |              229.93 ms |             1.75 ms |
| Shop relevance search, 100,000 cosmetics, warm                |               74.58 ms |             7.77 ms |
| Historical insights retention, 100 days / 200,000 memberships | 585.4 ms / 100 queries |   15.9 ms / 1 query |

User search validates scalar inputs and pagination, treats wildcard characters literally, and uses deterministic ordering with B-tree and optional trigram indices. Permission hydration retains complete member data and immediate revocation behavior. Own-profile requests skip redundant mutual queries. Catalog indices belong to one current snapshot with at most four cached sort arrays; seven live search responses retained exactly the same IDs, totals and pagination, and all 140 warm HTTP requests succeeded. Insights retain recorded zeroes and guild isolation while grouping historical cohort queries; UTC boundaries also remain stable when the host timezone changes.

Database initialization now shares an in-flight attempt, releases migration locks even after failures and destroys failed pools before retrying. Six real PostgreSQL cleanup and retry checks passed.

## Slowmode

The old last-message check allowed concurrent sends to pass before either saved its message, and deleting the last message erased the cooldown evidence. Governed sends now serialize per user/channel across processes using a PostgreSQL transaction advisory lock, recheck the cooldown, and save the message, read state, member/channel pointers and successful-send marker in one short transaction. Failure rolls back those writes and consumes no cooldown. The marker expires after six hours, the maximum channel slowmode duration; current settings determine the remaining cooldown.

Slowmode now applies to owners, administrators and members with Manage messages, Manage channels or Bypass slowmode. The operator can explicitly enable `limits.channel.allowSlowmodeBypass` to restore permission exemptions. Message edits and webhook messages do not consume user slowmode. Disabled slowmode avoids an additional permission lookup. Typing responses use the same retained timestamp, including after a message is deleted. The existing Discord client displays the countdown, blocks another Enter while preserving the draft, and honors HTTP 429 code 20016 with `retry_after` in seconds; those behaviors were checked with both an ordinary member and the instance administrator in Brave.

Thirteen real PostgreSQL checks cover those cases, default owner/admin enforcement, explicit permission exemptions, transaction rollback, ephemeral thread exclusions, read-state preservation and concurrent exempt/disabled sends. The latest owner/admin API run accepted exactly one of 16 sends, rejected the other 15 with code 20016 and persisted one message. The native owner composer retained the next draft and showed a countdown without issuing another send request. [Owner/admin report](qa/admin-performance/slowmode-owner-live.json). The earlier report below used the former permission exemptions. A separate generic API rate limiter was bypassed only for that concurrency fixture, with the account's original rights restored afterward. The message lookup uses a partial channel/author/timestamp index: on 100,000 rows, it fell from 5.305 ms and 1,763 buffer hits to 0.028 ms and five buffer hits. [Live API report](qa/admin-performance/slowmode-live.json), [index plan comparison](qa/admin-performance/slowmode-index.json).

The live check also exposed a preexisting race where simultaneous messages both inserted the first read-state row and one returned HTTP 500. The sender now uses a conflict-safe insert, retains the existing row ID, flags, acknowledgment and badge fields, and advances the private marker to the greatest sent message ID. It also removes one read-state lookup per send.

## Pride badges

Profiles settings now includes a searchable picker for 33 local pride flags, with native Discord inputs, checkbox tiles and save/remove buttons. The shared component adapters support other Fosscord settings too; [desktop and mobile screenshots](native-ui.md) verify theme controls and navigation. Selections have their own validated column and cannot grant or remove admin-assigned badges. No-op saves avoid database writes and observer broadcasts. Public update markers refresh already-cached profiles through a bounded client refetch; generic user projections do not select the storage column.

The Brave smoke selected all 33, verified local artwork on an ordinary friend's profile without overflow, changed and removed badges while that profile remained open, checked search/subset selection, and restored the original selections. All existing badges remained intact. [Rendered profile](qa/admin-performance/pride-profile.png), [artwork contact sheet](qa/admin-performance/pride-art-contact.png), [flag references and offline generator](pride-badges.md).

Eight controlled client regressions also cover rapid selection changes during a pending profile response. The refresh loop records the latest marker, coalesces changes, shares its completion promise and permits at most 32 active profiles. This repairs a stale result after an A/B/A/B sequence, without allocating a queue entry per event.

## Profile widget integration

Origin gained application profile widgets while this batch was running. The normal merge retains those commits, including the developer portal, bot-supplied values and native Your Profile Widgets picker. The combined client checker passed, and a browser checked that picker plus the pride controls without modifying persisted widgets.

The API review reproduced two issues: another viewer could read an unselected widget's identity and unused stored values, and array/string data could pass validation after being converted into an object. Public identity responses now include only selected application widgets and data keys used by their public render surfaces. Own-profile requests retain picker candidates and preview fields; the application owner's or linked bot's management endpoint retains the full stored values. Inputs are validated before merging, with bounded keys and values. Identity lookup also uses Maps instead of repeated linear searches. Six real PostgreSQL privacy, authorization and validation checks passed. The final live API run preserved self previews, kept unrelated identities/values private, rejected malformed inputs and unauthorized writes, accepted local artwork and rejected external image URLs. Fixtures were cleaned. [Pre-fix API report](qa/admin-performance/widget-privacy-before.json), [fixed API report](qa/admin-performance/widget-privacy-after.json), [native widget picker](qa/admin-performance/widgets-own-tab.png).

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
- Durable scheduled-message publish deduplication, further insights computation, bounded startup poll recovery, thread archiver overlap and fair purge scheduling.
- CDN cache quotas, streaming large uploads, bounded ffmpeg queues and API-to-CDN upload deadlines.
- SFU subscriber indexing instead of all-peer snapshots, replaced-track reader cancellation and H.264 negotiation compatibility. Microbenchmarks do not settle real audio/video capacity.
- Process-local interaction records/timers prevent reliable horizontal scaling; entity permission resolution remains N+1, and remote HTTP interaction validation needs an end-to-end deadline.
- Encryption backup failure markers, bounded plaintext caches, batching key lookups and negative-cache behavior.
- Publishing client assets as one complete versioned snapshot, rather than individual atomic files plus a final index update.
- OpenAPI discovery now finds 550 paths and 594 schemas. It still reports five routes without route middleware, 21 unresolved response schemas and 260 missing response declarations.

The broad dashboard has more coverage, but it does not yet expose every database field or solve every compatibility issue. Add controls deliberately with validation, rights checks, persistence and gateway event verification rather than a raw unrestricted database editor.

## Verification status

The current focused JavaScript command passed 100 tests, skipped eight database-dependent cases, and failed none. The relevant database suites were enabled separately, including eleven slowmode/concurrent-send checks, six widget privacy checks, six fresh-database cleanup/retry checks and five historical insights checks. Source builds, scoped lint/formatting, generated schemas/OpenAPI, dashboard persistence/browser checks and the Vencord patch check passed. The earlier 17 compiled TypeScript and six SFU race tests also passed. On source revision `43e3c61f7`, the final integrated encryption browser run passed in 219.4 seconds, and the compatibility probe passed 151 checks with one optional integration skipped and no failures. The forwarding probe uses a fresh plaintext fixture because the preceding encryption test enables encryption in the existing DM; encryption enforcement remains intact. The probe supports an explicit isolated account file, redacts credentials in diagnostics, and exits nonzero on failures.

The full Vencord typecheck separately reports five existing errors in ClanBadges/Frames/TemplateLinks JSX types and the E2EE settings component signature. It has no diagnostics in the new pride plugin. The production web bundle builds and the required client patch checker passes; that does not imply the broader typecheck is clean.

The initial stricter voice probe reached connected ICE but produced zero outbound RTP with both current and pre-change SFU binaries. Instrumenting the encryption worker traced this to missing cached `importScripts` dependencies, which prevented the encryption handler and audio pipeline from starting. The client downloader now expands runtime chunk maps in every JavaScript file, including workers, and refuses to publish a new index when any dependency fails. Individual asset writes are atomic; publication of the entire asset directory is still not atomic. The local snapshot was repaired using exact official Discord static assets, with runtime external-request policy unchanged. Its read-only, network-free `node scripts/client.js --check` verifies 12,027 reachable assets with zero missing files; five downloader regressions pass.

With the repaired snapshot, the normal Brave client (no diagnostic asset overlay) passed bidirectional audio/video, forced voice-websocket drop, resume and leave checks. Opcode 9 acknowledged resume without re-identification or replacing the peer connection. Fresh audio and video packet counters continued increasing; the friend decoded 479 video frames at about 20 fps after resume, with zero reported loss or freezes in this bounded two-client run. The peer observed departure within 347 ms. [Packet report](qa/admin-performance/voice-audio-video.json). This establishes local packet transport and video decode, not multi-client SFU capacity or an independent cryptographic security audit. Chrome passed the short normal audio/video run but exited unexpectedly during longer reconnect attempts. Brave passed the full reconnect/leave run; the cause of the longer Chrome shutdown remains unresolved.

## Reproduce

Use an isolated worktree/database as described in README. Never point the mutation probes at production. The alias preload supports symlinked dependencies.

```sh
npm run build
node --test scripts/dev/cdn-storage.test.cjs scripts/dev/gateway-lifecycle.test.cjs scripts/dev/gateway-permissions.test.cjs scripts/dev/openapi-discovery.test.cjs scripts/tests/*.test.cjs
node -e 'require("dotenv").config({quiet:true}); process.env.MEMBER_REQUEST_DATABASE=process.env.DATABASE; require("./scripts/dev/gateway-members.test.cjs")'
node -e 'require("dotenv").config({quiet:true}); process.env.READ_STATE_DATABASE=process.env.DATABASE; require("./scripts/tests/read-state-performance.test.cjs")'
node -e 'require("dotenv").config({quiet:true}); process.env.SCHEDULED_TEST_DATABASE=process.env.DATABASE; require("./scripts/tests/scheduled-message-delivery.test.cjs")'
node scripts/client.js --check
PORT=3290 node scripts/dev/client-assets-bench.mjs --requests 1000 --output asset-report.json
PORT=3290 node scripts/dev/admin-api-test.mjs
PORT=3290 node scripts/dev/admin-smoke.mjs
PORT=3290 node scripts/dev/admin-bench.mjs --paths /admin --concurrency 1,8,32 --requests 1000 --output report.json
CHROME_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" PORT=3290 node scripts/dev/e2ee-test.mjs
PORT=3290 node scripts/dev/voice-probe.mjs --browser "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
```

The API probe modifies and restores local fixture fields. The browser smoke saves an unchanged profile, verifies dirty-drawer protection and opens the channel editor. Benchmark requests are GET-only. The persistent demo is hosted at `http://localhost:3290/admin/` from `/tmp/fosscord-admin-perf`, managed by launchd service `zip.tiago.fosscord.demo`. Its generated login account is stored in that worktree’s ignored `scripts/dev/.test-account` file.

The browser helpers require Playwright in the existing `~/.cache/fosscord-tools` tool environment.

## Latest account controls

Operators can now manage target-user pride badges, profile widget layout and client preferences, with actor/target customization history. The real browser/API check verified permission denial for ordinary users, invalid badge rejection, native-client preference synchronization and save behavior; fixtures were restored. [Coverage audit](admin-api-coverage.md) lists remaining gaps, and [account customization screenshot](qa/admin-user-customization.png) shows the added controls.

Private chats require encryption; signed-in device linking normally runs in the background. A locked browser requires a simple account-password prompt, while per-message lock decorations are removed and the header indicator stays muted. Guild text encryption remains separate work. [Encryption behavior](e2ee.md), [signup verification](cap-signup.md), and [external service inventory](external-services.md) describe the policy and its limits.
