# Fosscord work backlog

This is the working queue for the continuing admin, app, compatibility and performance work. Unchecked entries are planned investigations or acceptance targets, not claims that every item is a confirmed bug. Source pointers identify where to start. Mark an item complete only after its behavior is verified; record the commit and evidence below.

## Current batch

| Item                                        | Owner                    | State                                     | Acceptance                                                                                                            |
| ------------------------------------------- | ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| CAP-001 through CAP-007, CAP-010/012        | Signup integration       | Shipped                                   | Visible local Cap; ordinary Chromium/WebKit signup, retained proof, expiry/replay and bounded workers.                |
| MOD-003, MOD-005/006/007                    | Modal integration        | Shipped                                   | Nested banner picker backdrop/Escape closes only that picker. Original banner-under-frame report remains unconfirmed. |
| FLAG-001 through FLAG-006, FLAG-009/010/011 | Pride integration        | Shipped                                   | All 40 upstream flags plus 10 local template additions; 50 selectable icons and preserved selections.                 |
| ADM-001 through ADM-005                     | Root integration         | Shipped                                   | Search cancellation, latest result wins and accessible failure Retry.                                                 |
| PERF-003/004/006                            | Root integration         | Shipped                                   | Permission query reduction measured on a 33-member fixture; not capacity proof.                                       |
| FREE-001 through FREE-006                   | Free feature integration | Shipped                                   | Subscription badges/controls removed; free features and native optional gradient.                                     |
| LOAD-001 through LOAD-005                   | Loading integration      | Shipped                                   | Instance admin tips/SVG, preview/reset, strict validation and cache invalidation.                                     |
| GIF-011                                     | GIF integration          | Shipped                                   | Provider selection in Settings; real Tenor results checked; live Klipy still requires a usable key.                   |
| SEC-009/010                                 | Session integration      | Shipped                                   | Session-bound resume/refresh; exact revocation and cross-session denial checked live.                                 |
| SEC-011/012                                 | Upload integration       | Shipped                                   | Upload authorization before body parsing; bounded pending and retained cloud staging.                                 |
| SEC-013                                     | Storage queue            | Design retained; queued after sticker fix | Aggregate posted storage, including cloned/reused files and failed-delete accounting.                                 |
| SEC-014/015                                 | Security queue           | Open                                      | Cloud conversion ownership and remaining general URL-fetch protections.                                               |
| BRAND-001 through BRAND-005                 | iphone_signup            | Implementing                              | Exact supplied Meowcord artwork and default animation, preserving admin overrides.                                    |
| STICKER-001/002                             | gif_providers            | Investigating                             | Reproduce native “Uh Oh!” and verify the repaired picker/send path.                                                   |
| ANN-002 through ANN-005                     | private_e2ee_review      | Implementing                              | Persistent encrypted sender, durable bounded delivery and accurate counts, disposable recipient tests.                |
| DEMO-001, DEMO-002                          | Root integration         | Verified                                  | Persistent HTTP/gateway demo; initial/resume URLs use location.host.                                                  |

P0 means a reported crash, trapped flow or broken core interaction. P1 means active completeness, reliability or measured performance work. P2 means polish and consolidation. The task IDs remain stable when priorities change.

## Verified baseline

- [x] Mandatory encryption for new private messages, with no plaintext fallback; guild encryption is separate work. See [encryption](e2ee.md).
- [x] Password-only trusted-server recovery for published keys, with signatures, encrypted storage and atomic reset handling. Commits `00149c757`, `8437ed659`, `9d026894a`; 33 focused checks and a focused native recovery run passed. Lost unpublished keys remain a separate account-recovery issue.
- [x] Required local Cap core signup and selectable Standalone configuration. See [Cap](cap-signup.md). The reported loop and iPhone-sized WebKit registration have now been checked below; a physical iPhone has not been tested.
- [x] Admin slowmode enforcement by default, with an explicit operator bypass setting.
- [x] Native profile badge picker and local pride artwork; all upstream artwork has now been imported below.
- [x] Per-user badge, widget and preference controls with scoped rights. See [API coverage](admin-api-coverage.md).
- [x] Klipy/Tenor provider selection and operator Klipy configuration; live Klipy verification still needs a usable key.
- [x] Bounded read-only localhost route baseline recorded in [performance evidence](admin-performance.md); this is not production capacity proof.

## Signup and Cap (P0)

Start with `src/api/routes/auth; client/plugins/fosscordCap`.

- [x] **CAP-001** Reproduce the native “Wait! Are you a human?” loop after failed registration.
- [x] **CAP-002** Keep a valid core verification through correctable form validation errors.
- [x] **CAP-003** Prevent the native unsupported-provider captcha modal from trapping Cap signup.
- [x] **CAP-004** Reproduce registration in iPhone-sized Chromium and WebKit.
- [x] **CAP-005** Audit widget workers and WASM startup on Safari.
- [x] **CAP-006** Bound widget script loading and expose a retry after failure.
- [x] **CAP-007** Handle verification expiry while filling the registration form.
- [ ] **CAP-008** Prevent duplicate submit requests and repeated token consumption.
- [ ] **CAP-009** Handle retry after a disconnected registration request.
- [x] **CAP-010** Keep Cap visibly required and reject server-side bypasses.
- [ ] **CAP-011** Verify core and Standalone modes with incomplete configuration.
- [x] **CAP-012** Exercise duplicate email, invalid username, consent and invite failures.
- [ ] **CAP-013** Verify accessible verification focus and error announcements.
- [ ] **CAP-014** Verify disabled registration does not loop through verification.

## Modal layering and dismissal (P0)

Start with `client/plugins; assets/public/admin`.

- [ ] **MOD-001** Reproduce banner preview beneath an expanded profile.
- [ ] **MOD-002** Fix the banner preview and expanded-profile stacking order.
- [x] **MOD-003** Make outside clicks dismiss the change-banner picker.
- [ ] **MOD-004** Inventory outside-click behavior for every custom modal and popover.
- [x] **MOD-005** Prevent backdrop clicks from reaching underlying controls.
- [x] **MOD-006** Keep clicks inside a dialog from dismissing it.
- [x] **MOD-007** Close only the topmost nested dialog with Escape.
- [ ] **MOD-008** Return keyboard focus to the opener after dismissal.
- [ ] **MOD-009** Confirm unsaved edits before outside-click dismissal.
- [ ] **MOD-010** Keep required signup and locked-browser dialogs required.
- [ ] **MOD-011** Verify overlays in desktop and mobile layouts.
- [ ] **MOD-012** Remove stale backdrops after route changes or errors.
- [ ] **MOD-013** Use native portal layers instead of arbitrary competing z-index values.
- [ ] **MOD-014** Test scroll locking and restoration for nested dialogs.

## Pride flags and profile badges (P1)

Start with `src/api/util/utility/prideBadges.ts; client/plugins/fosscordPride`.

- [x] **FLAG-001** Vendor every real SVG from the pinned twemoji-flags catalog.
- [x] **FLAG-002** Preserve existing badge slugs, IDs and saved selections.
- [x] **FLAG-003** Include upstream graphics licensing and attribution.
- [x] **FLAG-004** Verify the manifest covers every upstream flag exactly once.
- [x] **FLAG-005** Keep all flag artwork on the local instance.
- [x] **FLAG-006** Check native picker and admin catalog use the same flag list.
- [ ] **FLAG-007** Verify badges render in compact and expanded profiles.
- [ ] **FLAG-008** Check selection search, keyboard interaction and empty results.
- [x] **FLAG-009** Check the complete catalog on a narrow mobile screen.
- [x] **FLAG-010** Adapt all ten legacy supplemental flags from the Twemoji template and identify their provenance separately.
- [x] **FLAG-011** Verify duplicate and unknown flag validation.
- [ ] **FLAG-012** Measure profile badge rendering with a large selection.

## Admin navigation and lists (P1)

Start with `assets/public/admin/admin.js; src/api/routes/admin`.

- [x] **ADM-001** Cancel superseded Users and Servers search requests.
- [x] **ADM-002** Prevent stale responses from replacing newer search results.
- [x] **ADM-003** Stop delayed searches after navigating away.
- [x] **ADM-004** Separate navigation search visibility from route authorization.
- [x] **ADM-005** Announce loading and provide a working Retry action.
- [ ] **ADM-006** Preserve existing rows while refreshing lists.
- [ ] **ADM-007** Validate server search and pagination inputs consistently.
- [ ] **ADM-008** Treat percent and underscore as literal search text.
- [ ] **ADM-009** Add bounded or cursor pagination for very large lists.
- [ ] **ADM-010** Check keyboard navigation, labels and mobile table overflow.
- [ ] **ADM-011** Keep dirty drawers protected during navigation and refresh.
- [ ] **ADM-012** Inventory every drawer field against server validation.
- [ ] **ADM-013** Provide useful empty states with one relevant action.
- [ ] **ADM-014** Verify permission-restricted navigation and direct links.

## User administration (P1)

Start with `docs/admin-api-coverage.md; src/api/routes/admin/users`.

- [ ] **USR-001** Inventory remaining per-user API coverage with exact evidence.
- [ ] **USR-002** Make preference writes and audit records transactional.
- [ ] **USR-003** Add server-specific nickname and profile administration.
- [ ] **USR-004** Add explicit per-server member-role controls.
- [ ] **USR-005** Add validated per-server avatar, banner and theme controls.
- [ ] **USR-006** Add scoped membership and timeout administration.
- [ ] **USR-007** Add per-user saved-avatar management.
- [ ] **USR-008** Add connected-account metadata and disconnect controls.
- [ ] **USR-009** Add notification and consent preference administration.
- [ ] **USR-010** Add saved-message metadata administration.
- [ ] **USR-011** Add scheduled-message administration without exposing encrypted contents.
- [ ] **USR-012** Add per-user entitlement and collectible ownership adjustments.
- [ ] **USR-013** Record inventory and currency changes with explicit transactions.
- [ ] **USR-014** Keep password hashes, session tokens and private keys out of ordinary projections.

## Shop and packs (P1)

Start with `src/api/routes/admin/store; assets/public/admin`.

- [ ] **SHOP-001** Verify every pack field is editable and persisted.
- [ ] **SHOP-002** Verify every item field is editable and persisted.
- [ ] **SHOP-003** Check pack item reordering and movement between packs.
- [ ] **SHOP-004** Add clear preview and validation for artwork uploads.
- [ ] **SHOP-005** Verify hidden built-in pack behavior and restoration.
- [ ] **SHOP-006** Keep Discord decoration assets free in the local shop.
- [ ] **SHOP-007** Add server-free sticker and emoji packs.
- [ ] **SHOP-008** Define ownership, visibility and sharing for server-free expression packs.
- [ ] **SHOP-009** Add import and export for local pack metadata.
- [ ] **SHOP-010** Check shop rendering with thousands of items.
- [ ] **SHOP-011** Bound item and pack administration responses.
- [ ] **SHOP-012** Verify catalog invalidation after edits and deletes.
- [ ] **SHOP-013** Audit item deletion and dangling equipped decorations.
- [ ] **SHOP-014** Verify profile frames, effects and nameplates across profile layouts.

## Server administration (P1)

Start with `docs/admin-api-coverage.md; src/api/routes/admin/guilds`.

- [ ] **GUILD-001** Add member search and paginated member administration.
- [ ] **GUILD-002** Expose channel permission-overwrite management.
- [ ] **GUILD-003** Expose complete thread and forum settings.
- [ ] **GUILD-004** Expose invite lifecycle controls.
- [ ] **GUILD-005** Expose ban, unban and timeout controls with audit entries.
- [ ] **GUILD-006** Expose emoji and sticker management.
- [ ] **GUILD-007** Expose soundboard management.
- [ ] **GUILD-008** Expose scheduled-event management.
- [ ] **GUILD-009** Expose onboarding configuration and prompts.
- [ ] **GUILD-010** Expose member applications and join-request review.
- [ ] **GUILD-011** Expose integrations and webhook settings with scoped rights.
- [ ] **GUILD-012** Verify ownership transfer and operator-target safeguards.
- [ ] **GUILD-013** Check server features against client-supported values.
- [ ] **GUILD-014** Verify mutations reach active clients through gateway events.

## Performance and bounded work (P1)

Start with `docs/admin-performance.md; src/api/util/handlers`.

- [ ] **PERF-001** Measure current slow routes with realistic isolated fixtures.
- [ ] **PERF-002** Record baseline query counts before each optimization.
- [x] **PERF-003** Batch repeated permission reads for resolved interaction members.
- [x] **PERF-004** Reuse validated user/member context without changing permission semantics.
- [ ] **PERF-005** Bound interaction HTTP execution with an end-to-end deadline.
- [x] **PERF-006** Replace per-member permission queries with shared context where safe.
- [ ] **PERF-007** Bound gateway outbound and replay byte budgets.
- [ ] **PERF-008** Bound channel history and search relation loading.
- [ ] **PERF-009** Measure short-term search and expensive exact counts.
- [ ] **PERF-010** Bound encryption plaintext caches and key lookup batches.
- [ ] **PERF-011** Add CDN cache quotas and eviction measurements.
- [ ] **PERF-012** Bound ffmpeg work queues and API-to-CDN upload deadlines.
- [ ] **PERF-013** Avoid global voice locks around network work.
- [ ] **PERF-014** Index SFU subscribers instead of repeatedly snapshotting all peers.
- [ ] **PERF-015** Measure admin search and drawer latency under concurrency.
- [ ] **PERF-016** Keep benchmark claims tied to fixture size, host and revision.

## Background jobs and reliability (P1)

Start with `docs/admin-performance.md; src/util`.

- [ ] **JOB-001** Make scheduled-message publication durably idempotent.
- [ ] **JOB-002** Verify scheduler behavior across simultaneous workers.
- [ ] **JOB-003** Bound startup poll recovery and progress reporting.
- [ ] **JOB-004** Prevent overlapping thread archiver work.
- [ ] **JOB-005** Make purge scheduling fair across busy servers.
- [ ] **JOB-006** Verify insight computation inputs and incremental updates.
- [ ] **JOB-007** Cancel replaced-track readers in the SFU.
- [ ] **JOB-008** Bound retry queues and backoff under dependency failure.
- [ ] **JOB-009** Make shutdown drain tasks without hanging indefinitely.
- [ ] **JOB-010** Audit process-local interaction state for horizontal scaling.
- [ ] **JOB-011** Document job ownership, deadlines and failure recovery.
- [ ] **JOB-012** Verify unexpected database errors propagate instead of recursively retrying.

## Compatibility and app behavior (P1)

Start with `docs/parity.md; client/plugins; client/vencord-patches`.

- [ ] **APP-001** Run current native patch checks after plugin changes.
- [ ] **APP-002** Keep required native patches compatible with upstream build changes.
- [ ] **APP-003** Verify slowmode for ordinary users, moderators and owners.
- [ ] **APP-004** Keep countdowns and retained drafts consistent with server rejection.
- [ ] **APP-005** Verify profile banner preview outside expanded profiles.
- [ ] **APP-006** Verify themes and contrast across every custom component.
- [ ] **APP-007** Check iPhone registration and desktop registration flows.
- [ ] **APP-008** Check Android-sized navigation and settings layouts.
- [ ] **APP-009** Check reduced-motion and keyboard-only behavior.
- [ ] **APP-010** Verify account and server customization updates without reload.
- [ ] **APP-011** Keep guild messaging behavior intact while private chats require encryption.
- [ ] **APP-012** Audit safe clipboard and download behavior on mobile Safari.
- [ ] **APP-013** Verify worker dependencies are available from the local snapshot.
- [ ] **APP-014** Resolve existing broader Vencord typecheck failures explicitly.

## GIFs and external dependencies (P1)

Start with `docs/external-services.md; client/plugins; src/api/routes/gifs`.

- [ ] **GIF-001** Verify Klipy search, categories and pagination with a configured key.
- [ ] **GIF-002** Verify Tenor fallback and provider selection.
- [ ] **GIF-003** Persist the Klipy key only in operator settings.
- [ ] **GIF-004** Keep credentials out of public settings and logs.
- [ ] **GIF-005** Show a useful empty state when the chosen provider is unavailable.
- [ ] **GIF-006** Bound provider requests and cache validated responses.
- [ ] **GIF-007** Audit all remaining runtime third-party requests.
- [ ] **GIF-008** Keep optional external integrations disabled without explicit configuration.
- [ ] **GIF-009** Verify native media previews use local proxy policy where applicable.
- [ ] **GIF-010** Document unavoidable provider dependencies and offline alternatives.

## Encryption and recovery (P1)

Start with `docs/e2ee.md; client/e2ee`.

- [ ] **ENC-001** Verify existing account recovery state without resetting history.
- [ ] **ENC-002** Ensure trusted browsers publish recovery after successful key setup.
- [ ] **ENC-003** Verify password-only recovery after server restart.
- [ ] **ENC-004** Verify password changes keep the same message keys.
- [ ] **ENC-005** Verify failed recovery never sends a private message in plaintext.
- [ ] **ENC-006** Keep the default header neutral and remove per-message decorations.
- [ ] **ENC-007** Keep strict-browser behavior accurately described.
- [ ] **ENC-008** Measure and bound history backfill work.
- [ ] **ENC-009** Distinguish unavailable recovery service from permanently missing keys.
- [ ] **ENC-010** Add operator diagnostics that expose status but never secrets.
- [ ] **ENC-011** Verify recovery master persistence and failure on a missing master.
- [ ] **ENC-012** Audit key rotation, reset and recovery races.
- [ ] **ENC-013** Keep private-channel enforcement consistent for all senders.
- [ ] **ENC-014** Plan guild encryption separately with an explicit compatibility design.

## Components and accessibility (P2)

Start with `docs/native-ui.md; client/plugins/fosscordCore`.

- [ ] **UI-001** Inventory duplicated buttons, fields, dialogs and search controls.
- [ ] **UI-002** Reuse native Discord components where the interface supports them.
- [ ] **UI-003** Define shared semantic colors and spacing for custom surfaces.
- [ ] **UI-004** Define a consistent modal, popover and backdrop contract.
- [ ] **UI-005** Keep visible labels and associated validation messages.
- [ ] **UI-006** Make icon-only actions keyboard accessible and named.
- [ ] **UI-007** Verify touch targets and focus rings.
- [ ] **UI-008** Check long names, IDs and translated labels for overflow.
- [ ] **UI-009** Keep counters and timers from shifting layout.
- [ ] **UI-010** Provide copy that identifies the failed action and recovery step.
- [ ] **UI-011** Avoid decorative motion for frequent actions.
- [ ] **UI-012** Check nested radius alignment and compact profile badge artwork.

## Tests and benchmarking (P1)

Start with `scripts/dev; scripts/tests; docs/qa`.

- [ ] **QA-001** Keep all mutation probes on explicitly isolated databases.
- [ ] **QA-002** Create disposable test accounts instead of reusing demo users.
- [ ] **QA-003** Preserve recoverable fixture keys on interrupted encryption tests.
- [ ] **QA-004** Stop resetting global rate limits in test cleanup.
- [ ] **QA-005** Add an overlay smoke for click-outside, Escape and stacking.
- [ ] **QA-006** Add a Cap failure and retry browser smoke.
- [ ] **QA-007** Add a mobile signup smoke with captured console failures.
- [ ] **QA-008** Run route smoke after backend changes and demo restart.
- [ ] **QA-009** Run relevant PostgreSQL fixtures separately from skipped unit cases.
- [ ] **QA-010** Store query counts and latency distributions with source revisions.
- [ ] **QA-011** Build a medium-sized isolated load fixture before capacity claims.
- [ ] **QA-012** Measure sustained behavior and resource use, not only throughput.
- [ ] **QA-013** Verify failed tests restore only their own fixtures.
- [ ] **QA-014** Separate focused browser checks from full-suite success claims.

## Upstream and operations (P1)

Start with `CONTRIBUTING.MD; docs/deploy.md; scripts/client.js`.

- [ ] **OPS-001** Refresh upstream history and report whether new commits need integration.
- [ ] **OPS-002** Keep normal pushes directly to main within the user-authorized workflow.
- [ ] **OPS-003** Commit verified changes in small coherent batches.
- [x] **OPS-004** Update this backlog when work starts, ships or is blocked.
- [ ] **OPS-005** Keep localhost demo source synchronized with committed main.
- [x] **OPS-006** Correct stale test guidance about global rate-limit resets.
- [ ] **OPS-007** Document safe current commands for encryption fixtures.
- [ ] **OPS-008** Publish complete versioned client asset snapshots.
- [ ] **OPS-009** Verify deployment health and service restart behavior.
- [ ] **OPS-010** Keep private keys, credentials and test accounts out of Git.
- [ ] **OPS-011** Check rollback and asset-cache behavior after client updates.
- [ ] **OPS-012** Document benchmark and browser limitations honestly.

## Loading customization (P1)

These settings apply to the whole instance, through the admin dashboard; no per-guild overrides were requested.

- [x] **LOAD-001** Locate native loading tips and animation before selecting integration points.
- [x] **LOAD-002** Let instance admins add, edit, reorder and remove loading tips.
- [x] **LOAD-003** Let instance admins customize the loading SVG with bounded safe validation.
- [x] **LOAD-004** Preview the animation and tips in the admin dashboard.
- [x] **LOAD-005** Restore built-in defaults without losing unrelated configuration.
- [ ] **LOAD-006** Verify loading customization on desktop and mobile without remote asset requests.

## Free features (P1)

- [x] **FREE-001** Remove native subscription upsells and visible Nitro/Premium branding.
- [x] **FREE-002** Stop synthesizing or displaying subscription badges.
- [x] **FREE-003** Preserve Discord wire compatibility while granting the supported features to everyone.
- [x] **FREE-004** Add an explicit native profile-gradient toggle.
- [x] **FREE-005** Remove subscription choices and badge controls from the admin dashboard.
- [x] **FREE-006** Verify free features and gradient persistence in actual profiles.

## Security and storage (P0/P1)

These are audit targets, not findings. Record a reproducible exploit or a concrete missing enforcement boundary before calling one a vulnerability.

- [ ] **SEC-001** Audit account, per-file and instance aggregate storage bounds.
- [ ] **SEC-002** Check concurrent upload quota reservations and failed-upload release.
- [ ] **SEC-003** Audit attachment upload authentication, ownership and signed upload slots.
- [ ] **SEC-004** Bound multipart memory, field sizes and decompression/image processing.
- [ ] **SEC-005** Check remote asset fetching for SSRF, redirects and response size limits.
- [ ] **SEC-006** Verify path traversal and symlink containment for storage adapters.
- [ ] **SEC-007** Audit admin authorization and user impersonation boundaries.
- [ ] **SEC-008** Add meaningful regression checks for confirmed vulnerabilities and document remaining gaps.

## New user reports

- [x] **GIF-011** Remove the GIF picker provider dropdown and move provider selection to Settings.
- [x] **DEMO-001** Check reported localhost outage with HTTP health and authenticated compressed gateway handshake. HTTP 200, HELLO and READY passed on 2026-10-04; the earlier refusal was not reproduced. The separately reported hardcoded-host bug is fixed in DEMO-002.

- [x] **DEMO-002** Use `location.host` for both initial and resumed bundled-browser gateway connections. Real compressed HELLO checks passed on localhost and fosscord.localhost; HTTPS, ports and IPv6 URL checks passed.

- [ ] **STICKER-001** Reproduce native sticker picker “Uh Oh!” and capture the failed endpoint/runtime error.
- [ ] **STICKER-002** Fix the confirmed cause and verify ordinary stickers render and send using disposable fixtures.
- [ ] **STICKER-003** Support independent sticker/emoji packs without requiring a guild, as previously requested.

## Branding archive (P1)

Source supplied by the user: `/Users/tiago/Downloads/meowcord-logo.zip`. Preserve its exact cat paths, purple app tile, adaptive favicon and flip/whisker animation.

- [ ] **BRAND-001** Vendor the supplied artwork locally and record provenance.
- [ ] **BRAND-002** Use the supplied app tile for app/PWA icons and default avatars.
- [ ] **BRAND-003** Replace fallback brand glyphs and favicon with the supplied SVGs.
- [ ] **BRAND-004** Make the supplied spinner the default loading animation while preserving the admin's custom SVG override.
- [ ] **BRAND-005** Check dark/light/mobile renders and reduced-motion behavior.

## Announcement delivery (P0)

- [x] **ANN-001** Trace reported delivery failure. The plaintext system-DM path conflicts with mandatory private-message encryption, and the background loop masks failure behind HTTP 201.
- [ ] **ANN-002** Encrypt system announcements with a server-managed signed sender, without resetting recipient keys or allowing plaintext.
- [ ] **ANN-003** Report queued, delivered and failed counts accurately.
- [ ] **ANN-004** Bound fanout and preserve deletion/cancellation behavior.
- [ ] **ANN-005** Verify only disposable recipients receive and decrypt the test announcement, including attachments.

## Additional confirmed or source-level security findings

- [x] **SEC-009** Bind gateway resume to the original authenticated session; handler regressions, live cross-session denial and the full encryption suite passed.
- [x] **SEC-010** Preserve authentication-session identity during legacy token refresh.
- [x] **SEC-011** Enforce DM participant permission checks before attachment upload-slot creation.
- [x] **SEC-012** Bound both unfinished and retained completed cloud staging, and remove bearer upload paths from logs.
- [ ] **SEC-013** Add aggregate posted-storage/account/instance quotas; slot quotas alone do not bound cloned or posted files.
- [ ] **SEC-014** Require sender/channel ownership when converting cloud uploads into message attachments.
- [ ] **SEC-015** Fix DNS rebinding and byte bounds in general public URL fetching, webhook avatars and embeds; the component-media fix does not cover these paths.

## Progress ledger

The initial queue contains 200 open acceptance targets across 15 workstreams, plus eight verified baseline entries. New user reports go into the relevant stream before implementation. Review priority after each verified batch rather than treating this as a fixed release promise.

| Date       | Commit      | Completed tasks            | Evidence or limitation                                                                                           |
| ---------- | ----------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-10-04 | `9d026894a` | Baseline password recovery | Focused native 74.8 s, 33 focused checks, live API and fresh migrations; larger suite attempts did not complete. |

| 2026-10-04 | `5d7a75bf1` | OPS-004, OPS-006 | Initial 200-target backlog and safe isolated-test guidance. |
| 2026-10-04 | `01108c2d1` | ADM-001 through ADM-005 | Native desktop/mobile browser checks including delayed requests, cancellation and failure Retry. |
| 2026-10-04 | `92da33bb6` | PERF-003, PERF-004, PERF-006 | 33-member isolated PostgreSQL fixture: 133 queries to 4; median 24.3 ms to 4.2 ms. This is not capacity proof. |
| 2026-10-04 | `86c9133e7` | FLAG-001 through FLAG-006, FLAG-009 through FLAG-011 | 21 focused checks; native select/save/clear/profile refresh, all 50 local icons, dark/light/mobile renders; client checker passed. |

| 2026-10-04 | `fc2c3fdc4` | CAP-004/005 WebKit bootstrap | Ordinary iPhone-sized WebKit registration and proof replay passed; no physical iPhone claim. |
| 2026-10-04 | `9080b35dc` | MOD-003, MOD-005/006/007 | Native nested banner picker backdrop and Escape close only the picker, retaining dirty display-name input. Original banner-under-frame failure remains unconfirmed. |
| 2026-10-04 | `b959c4ba4` | Cap loop and retained proof | 9 real PostgreSQL tests; ordinary Chromium/WebKit signup, expired proof retry and replay checks. |
| 2026-10-04 | `ded8a100e` | GIF-011 | Settings selection, clean picker, real Tenor results and decoded media, Klipy reload persistence; two disposable accounts cleaned. |
| 2026-10-04 | `10a9544e4` | FREE-001 through FREE-004, FREE-006 | Four regressions; native gradient off/on persistence and desktop/mobile render; entitlement wire fields preserved. |
| 2026-10-04 | `db01cfe12` | Firefox login rejection | Passkey cancellation uses native AbortError. Three engines checked; fresh Firefox signup/login and heartbeat over 50 seconds passed. Original socket refusal not reproduced. |
| 2026-10-04 | `5ce30d478` | LOAD-001 through LOAD-005, FREE-005 | 10 loading/Cap settings regressions; real API, HTML cache invalidation, preview/reset, narrow admin layout and native SVG/tips render. |

| 2026-10-04 | `157f2302b` | DEMO-002 | Initial and resume URLs use location.host; two actual hostnames reached compressed HELLO. Client checker and normal bundle build passed. |
| 2026-10-04 | `96e7fe5ca` | SEC-009/010 | 13 regressions; live same-session resume, cross-session denial, revocation code 4006 and other-session survival. Full E2EE suite passed in 320.3 s with two UI retries. |
| 2026-10-04 | `f26314b6c` | SEC-005/008 component-media scope | 15 focused tests; pinned public DNS, redirect validation, deadlines and byte limits. General URL/webhook/embed paths remain open in SEC-015. |

| 2026-10-04 | `ffc7cf127` | SEC-011/012 | Six real PostgreSQL checks and ten HTTP tests, including withheld bodies, chunked/multipart bounds and zero-byte files. Full E2EE suite passed. Cloud staging quotas do not bound posted/cloned storage. |

## Verification rules

Use `/tmp/fosscord-admin-perf`, `fosscord_codex_admin` and localhost port 3290 for the persistent demo. The production checkout's private `.env` is not a test database. Never clear global rate limits or reset another account to make a probe pass. Use disposable accounts and restore fixtures in awaited cleanup.

A source review, unit fixture, live API check and browser render answer different questions; record the evidence actually obtained. Run the client patch checker for plugin changes, scoped builds/lint/formatting for source changes, and required integration probes for the touched subsystem. Load tests must state fixture size, concurrency, duration, revision and host limits. Preserve credentials, key files, recovery codes and browser profiles outside version control.
