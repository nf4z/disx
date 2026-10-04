# Signup verification

Account creation requires a visible Cap widget by default. The native signup form shows an account verification section before Create Account. Submitting without a solved challenge keeps the form in place and focuses verification. Expired or consumed tokens require another solve, and failures offer Retry verification.

The API enforces this independently of the browser: missing, invalid, expired or reused `captcha_key` values return HTTP 400. Registration invitations do not bypass verification and are not consumed by requests missing verification. Set `register.requireCaptcha` in Site settings to change the instance policy.

The built-in integration uses [Cap core](https://trycap.dev/guide/capjs-core) and serves the widget, WASM solver and decompression fallback locally. No extra API key or separate service is required. Challenge signatures derive a dedicated key from the instance's persisted request signature secret. Browser instrumentation and 50 SHA-256 challenges at difficulty four run for each solve. Challenges and solved tokens expire after five minutes. Automated-browser blocking is off; browser instrumentation still runs.

Challenge nonce redemption and solved-token consumption use atomic PostgreSQL operations in the existing expiring `rate_limits` store. Concurrent replays admit one winner. Only token hashes are stored; cleanup uses the existing expiry worker. Public challenge and redemption routes each permit 30 requests per IP per minute independently of the generic rate-limit switch.

An explicitly configured, enabled Cap Standalone instance with a site key and secret can replace the embedded challenge service. Existing optional login/reset captcha settings remain available. Signup uses Cap even when the optional captcha service is unconfigured or disabled.

## Verification

Seven real PostgreSQL tests cover production challenge settings, nonce and token replay, expiry, malformed proofs, required signup and invitation bypass prevention. The native browser smoke checks missing verification, successful signup, reset, replay rejection, load failure/retry and absence of external requests. The client patch checker passed on Discord build 627798. The compatibility probe passed 151 checks with one optional integration skipped.

```sh
CAP_REGISTRATION_TEST=1 APPLY_DB_MIGRATIONS=false DOTENV_CONFIG_PATH=/tmp/fosscord-admin-perf/.env node -r dotenv/config -r ./scripts/register-paths.cjs --test scripts/tests/cap-registration.postgres.cjs
PORT=3290 node scripts/dev/cap-signup-smoke.mjs
```

Run mutation checks only against an isolated database. API-based test provisioning uses `scripts/dev/cap-token.mjs` to solve a real challenge in a browser; there is no production test bypass.
