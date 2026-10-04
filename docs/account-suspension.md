# Suspension integration proof

Run only against the local, isolated admin demo:

```sh
RUN_SUSPENSION_SMOKE=1 DOTENV_CONFIG_PATH=/tmp/fosscord-admin-perf/.env node scripts/dev/account-suspension-smoke.mjs
```

The opt-in script guards the database name `fosscord_codex_admin` and local API/database hosts. It creates three disposable accounts through Cap and grants the temporary administrator only `MANAGE_USERS` in addition to its existing ordinary-account rights. It does not use or modify existing users.

The target sends a real encrypted native message to the witness before suspension. Two target sessions and their gateway connections are then tested against an unrelated witness connection. A temporary application and hashed OAuth bearer credential are seeded only for these fixtures; HTTP OAuth authorization is tested, rather than the OAuth issuance flow.

The live run passed:

- Standing 500 closed both target gateway sockets with code 4006 and invalid-session opcode 9, and removed both target sessions.
- Both target JWTs returned HTTP 401; password login returned HTTP 400; OAuth bearer authorization returned HTTP 401.
- The unrelated gateway remained connected and acknowledged a heartbeat. Its sessions and JWT access were preserved.
- Reversal to standing 100 allowed a fresh HTTP 200 login. The revoked session stayed HTTP 401; OAuth access resumed under the restored standing.
- History remained accessible after reversal, and the PostgreSQL encrypted envelope was byte-for-byte unchanged.
- The script removed its accounts, application, OAuth credential and conversation fixtures. Passwords, tokens and encryption keys are never printed.

This proof covers persisted standing, session invalidation and reversal. It does not establish MFA/reset-flow or webhook compatibility; those have separate focused tests in `scripts/tests/account-suspension.test.cjs`.
