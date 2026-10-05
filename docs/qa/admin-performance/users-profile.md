# Admin user-list profile

The route remains unchanged. The original 117 ms concurrency-16 p95 did not recur in three authenticated HTTP rounds: p95 was 45.7, 61.0 and 47.9 ms, with all 600 requests returning 200. This is a new baseline measurement, not an optimization gain.

The isolated database contained 74 users, with 50 selected per full page. The direct handler profiler measured page/count SQL, entity execution and the raw-to-entity transformer CPU time. It ran three rounds of 100 requests at concurrency 1 and 16 for the current serial implementation and two experimental alternatives, rotating their order. The entity timer includes the database wait; the hydration CPU timer measures only the transformer.

| In-process strategy | Concurrency | Median of round p50 (ms) | Median of round p95 (ms) | Hydration CPU median (ms) |
| ------------------- | ----------: | -----------------------: | -----------------------: | ------------------------: |
| serial              |           1 |                    0.989 |                    1.784 |                     0.065 |
| serial              |          16 |                    7.025 |                   12.701 |                     0.059 |
| parallel            |           1 |                    0.688 |                    1.058 |                     0.060 |
| parallel            |          16 |                    6.938 |                   10.652 |                     0.058 |
| window              |           1 |                    0.793 |                    2.073 |                     0.061 |
| window              |          16 |                    7.236 |                   12.956 |                     0.059 |

The current entity hydration cost is about 0.06 ms per 50-user page. Cloning the query and starting `getMany` and `getCount` together changes a small fraction of a millisecond at concurrency 1 and gives mixed concurrency-16 results. It also loses TypeORM's shortcut that omits a count query for a short first or final page. The window-count experiment halves full-page SQL round trips but must count the complete matching set in the page query, which can regress the existing indexed pagination on larger instances. Neither experiment is applied to the route.

All three strategies produced identical JSON for the full page, partial and empty offsets, a literal wildcard/backslash search, and each supported filter. Rights, column selection, normalization and ordering are still provided by the original route; no raw-row response replaces hydrated entities or their load hooks. No user rows, credentials or tokens appear in the reports.

`users-profile.json` contains the direct timing rounds; `users-http-rerun.json` contains the authenticated HTTP rounds. The HTTP session was created using the dedicated synthetic fixture and revoked afterward with status 204. No user data, rate-limit counters or instance settings were changed.

Run the profiler after compiling the current backend:

```sh
ADMIN_USERS_PROFILE=1 DATABASE=postgres://USER@localhost:5432/larpcord_codex_admin \
  ADMIN_USERS_PROFILE_OUTPUT=/tmp/admin-users-profile.json \
  node scripts/dev/admin-users-profile.cjs
```

The script rejects other database hosts/names, disables synchronization and migrations, and sets PostgreSQL connections to read-only. It uses one cached `ConfigValue` instance rather than loading or updating stored configuration. It invokes the real route handler against the real ORM but bypasses HTTP/authentication middleware, so those figures are not end-to-end latency or a production capacity result. Its full-page equality checks assume the small isolated dataset is stable during the run. Concurrent local work and GC remain sources of timing variation.
