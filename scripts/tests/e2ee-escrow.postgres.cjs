/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const assert = require("node:assert/strict");
const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const crypto = require("node:crypto");
const enabled = process.env.E2EE_ESCROW_TEST === "1";
const options = { skip: !enabled };
let entities, db, config, helper, util, put, recover, reset, fixture, passwordHash;
const users = [];
const password = "Disposable escrow fixture password";
const originalMaster = process.env.E2EE_RECOVERY_MASTER_KEY;
const keypair = (curve) => {
    const pair = crypto.generateKeyPairSync(curve);
    return { ...pair, jwk: pair.privateKey.export({ format: "jwk" }), public: pair.publicKey.export({ format: "jwk" }).x };
};
const sign = (key, message) => crypto.sign(null, Buffer.from(message), key).toString("base64url");
const box = (secret, userId, label, jwk) => {
    const key = Buffer.from(crypto.hkdfSync("sha256", secret, Buffer.alloc(32), `fosscord-e2ee/v1/backup/${label}`, 32));
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`${label}\n${userId}`));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(jwk)), cipher.final()]);
    return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64url");
};
const handler = (router, method, path = "/") => router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
const invoke = async (fn, subject = fixture, body = {}) => {
    let status = 200,
        result;
    const headers = {};
    await fn(
        { user_id: subject.user.id, session: subject.session, body },
        {
            setHeader(name, value) {
                headers[name] = value;
            },
            sendStatus(value) {
                status = value;
                return this;
            },
            json(value) {
                result = value;
                return this;
            },
        },
    );
    return { status, body: result, headers };
};
const upload = (subject = fixture, changes = {}) => {
    const body = {
        identity_key: subject.identity.public,
        backup_version: subject.backup.version,
        device_id: subject.device.id,
        backup_secret: subject.secret.toString("base64url"),
        ...changes,
    };
    body.signature = sign(subject.identity.privateKey, helper.recoveryProof(subject.user.id, body.identity_key, body.backup_version, body.device_id, body.backup_secret));
    return body;
};
const createFixture = async () => {
    const user = await entities.User.create({
        username: "Disposable escrow fixture",
        discriminator: "0000",
        bot: false,
        premium: false,
        premium_type: 0,
        verified: true,
        rights: "33554432",
        data: { hash: passwordHash, valid_tokens_since: new Date() },
        created_at: new Date(),
    }).save();
    users.push(user.id);
    const session = await entities.Session.create({ user_id: user.id, activities: [], client_info: { browser: "Escrow fixture" }, client_status: {}, status: "online" }).save();
    const identity = keypair("ed25519"),
        agreement = keypair("x25519"),
        signing = keypair("ed25519"),
        secret = crypto.randomBytes(32);
    await entities.E2eeIdentity.create({ user_id: user.id, public_key: identity.public, previous_key: null, rotation_signature: null, created_at: new Date() }).save();
    const device = await entities.E2eeDevice.create({
        id: util.e2eeDeviceId(signing.public),
        user_id: user.id,
        signing_key: signing.public,
        status: "active",
        session_id: session.session_id,
        prekey_id: 1,
        prekey_public: agreement.public,
        prekey_signature: "fixture",
        prekey_updated_at: new Date(),
        created_at: new Date(),
        revoked_at: null,
    }).save();
    device.identity_signature = sign(identity.privateKey, util.e2eeDeviceMessage(user.id, device.id, device.signing_key));
    await device.save();
    const backup = await entities.E2eeKeyBackup.create({
        user_id: user.id,
        version: 1,
        mode: "recovery",
        kdf: { name: "hkdf-sha256" },
        salt: crypto.randomBytes(16).toString("base64url"),
        wrapped_secret: null,
        identity_key: identity.public,
        wrapped_identity: box(secret, user.id, "identity", identity.jwk),
        backup_public_key: agreement.public,
        backup_key_signature: sign(identity.privateKey, util.e2eeBackupKeyMessage(user.id, agreement.public)),
        wrapped_backup_key: box(secret, user.id, "backup-key", agreement.jwk),
        updated_at: new Date(),
        trust: null,
        trust_version: 0,
    }).save();
    return { user, session, identity, agreement, device, backup, secret };
};
before(async () => {
    if (!enabled) return;
    assert.equal(new URL(process.env.DATABASE).pathname, "/fosscord_codex_admin");
    process.env.E2EE_RECOVERY_MASTER_KEY = crypto.randomBytes(32).toString("base64url");
    entities = require("../../dist/database");
    db = await entities.initDatabase();
    config = new (require("../../dist/util/config").ConfigValue)();
    mock.method(require("../../dist/util/util/Config").Config, "get", () => config);
    mock.method(require("../../dist/util/util/ipc/Event"), "emitEvent", async () => {});
    util = require("../../dist/api/util/utility/e2ee");
    helper = require("../../dist/api/util/utility/e2eeRecovery");
    passwordHash = await require("bcrypt").hash(password, 4);
    const router = require("../../dist/api/routes/users/@me/e2ee/backup/escrow").default;
    put = handler(router, "put");
    recover = handler(router, "post", "/recover");
    reset = handler(require("../../dist/api/routes/users/@me/e2ee").default, "post", "/reset");
});
beforeEach(async () => {
    if (!enabled) return;
    config.limits.e2ee.trustServerByDefault = true;
    fixture = await createFixture();
});
afterEach(async () => {
    if (!enabled) return;
    for (const id of users.splice(0)) await entities.User.delete({ id });
});
after(async () => {
    if (!enabled) return;
    mock.restoreAll();
    if (originalMaster === undefined) delete process.env.E2EE_RECOVERY_MASTER_KEY;
    else process.env.E2EE_RECOVERY_MASTER_KEY = originalMaster;
    if (db) await db.destroy();
});

test("signed linked-device upload recovers the current secret using the account password", options, async () => {
    const uploaded = await invoke(put, fixture, upload());
    assert.equal(uploaded.status, 204);
    assert.equal(uploaded.headers["Cache-Control"], "no-store");
    const row = await entities.E2eeRecovery.findOneByOrFail({ user_id: fixture.user.id });
    assert.ok(row.encrypted_secret.startsWith("v1."));
    assert.notEqual(row.encrypted_secret, fixture.secret.toString("base64url"));
    const result = await invoke(recover, fixture, { password });
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.equal(result.body.backup_secret, fixture.secret.toString("base64url"));
    assert.equal((await entities.E2eeKeyBackup.findOneByOrFail({ user_id: fixture.user.id })).mode, "recovery");
    assert.equal(JSON.stringify(fixture.backup.toPublic()).includes(fixture.secret.toString("base64url")), false);
});
test("wrong passwords and another account cannot recover an uploaded secret", options, async () => {
    await invoke(put, fixture, upload());
    await assert.rejects(invoke(recover, fixture, { password: "Incorrect disposable password" }));
    const other = await createFixture();
    await assert.rejects(invoke(recover, other, { password }), (error) => error.code === util.E2eeErrors.NO_BACKUP.code);
    await assert.rejects(invoke(put, other, upload()), (error) => error.code === util.E2eeErrors.BACKUP_CONFLICT.code);
    assert.equal(await entities.E2eeRecovery.countBy({ user_id: other.user.id }), 0);
});
test("disabled server trust blocks upload and recovery while preserving the encrypted row", options, async () => {
    await invoke(put, fixture, upload());
    config.limits.e2ee.trustServerByDefault = false;
    await assert.rejects(invoke(put, fixture, upload()), (error) => error.code === util.E2eeErrors.UNSUPPORTED.code);
    await assert.rejects(invoke(recover, fixture, { password }), (error) => error.code === util.E2eeErrors.UNSUPPORTED.code);
    assert.equal(await entities.E2eeRecovery.countBy({ user_id: fixture.user.id }), 1);
});
test("invalid proof and correctly signed incorrect secret cannot replace valid escrow", options, async () => {
    await invoke(put, fixture, upload());
    const before = await entities.E2eeRecovery.findOneByOrFail({ user_id: fixture.user.id });
    await assert.rejects(
        invoke(put, fixture, { ...upload(), signature: crypto.randomBytes(64).toString("base64url") }),
        (error) => error.code === util.E2eeErrors.INVALID_SIGNATURE.code,
    );
    await assert.rejects(
        invoke(put, fixture, upload(fixture, { backup_secret: crypto.randomBytes(32).toString("base64url") })),
        (error) => error.code === util.E2eeErrors.INVALID_BACKUP.code,
    );
    assert.equal((await entities.E2eeRecovery.findOneByOrFail({ user_id: fixture.user.id })).encrypted_secret, before.encrypted_secret);
});
test("stale backup version and identity are rejected before escrow persistence", options, async () => {
    await assert.rejects(invoke(put, fixture, upload(fixture, { backup_version: 2 })), (error) => error.code === util.E2eeErrors.BACKUP_CONFLICT.code);
    await assert.rejects(invoke(put, fixture, upload(fixture, { identity_key: keypair("ed25519").public })), (error) => error.code === util.E2eeErrors.BACKUP_CONFLICT.code);
    assert.equal(await entities.E2eeRecovery.countBy({ user_id: fixture.user.id }), 0);
});
test("pending, revoked, foreign, and mismatched-session devices cannot upload", options, async () => {
    for (const status of ["pending", "revoked"]) {
        await entities.E2eeDevice.update({ id: fixture.device.id }, { status });
        await assert.rejects(invoke(put, fixture, upload()), (error) => error.code === util.E2eeErrors.UNKNOWN_DEVICE.code);
    }
    await entities.E2eeDevice.update({ id: fixture.device.id }, { status: "active", session_id: "different-session" });
    await assert.rejects(invoke(put, fixture, upload()), (error) => error.code === util.E2eeErrors.UNKNOWN_DEVICE.code);
    await entities.E2eeDevice.update({ id: fixture.device.id }, { session_id: fixture.session.session_id });
    const other = await createFixture();
    await assert.rejects(invoke(put, fixture, upload(fixture, { device_id: other.device.id })), (error) => error.code === util.E2eeErrors.UNKNOWN_DEVICE.code);
    assert.equal(await entities.E2eeRecovery.countBy({ user_id: fixture.user.id }), 0);
});
test("corrupted escrow fails closed and current identity mismatches conflict", options, async () => {
    await invoke(put, fixture, upload());
    const row = await entities.E2eeRecovery.findOneByOrFail({ user_id: fixture.user.id });
    const bytes = Buffer.from(row.encrypted_secret.slice(3), "base64url");
    bytes[15] ^= 1;
    await entities.E2eeRecovery.update({ user_id: fixture.user.id }, { encrypted_secret: `v1.${bytes.toString("base64url")}` });
    await assert.rejects(invoke(recover, fixture, { password }));
    await entities.E2eeRecovery.update({ user_id: fixture.user.id }, { encrypted_secret: row.encrypted_secret });
    await entities.E2eeIdentity.update({ user_id: fixture.user.id }, { public_key: keypair("ed25519").public });
    await assert.rejects(invoke(recover, fixture, { password }), (error) => error.code === util.E2eeErrors.BACKUP_CONFLICT.code);
});
test("account password changes gate recovery with the current password", options, async () => {
    await invoke(put, fixture, upload());
    const next = "Changed disposable fixture password";
    const user = await entities.User.findOneOrFail({ where: { id: fixture.user.id }, select: { id: true, data: true } });
    await entities.User.update({ id: user.id }, { data: { ...user.data, hash: await require("bcrypt").hash(next, 4) } });
    await assert.rejects(invoke(recover, fixture, { password }));
    assert.equal((await invoke(recover, fixture, { password: next })).body.backup_secret, fixture.secret.toString("base64url"));
});
test("reset deletes escrow and prevents recovering the previous identity", options, async () => {
    await invoke(put, fixture, upload());
    await invoke(reset, fixture, { password, public_key: keypair("ed25519").public });
    assert.equal(await entities.E2eeRecovery.countBy({ user_id: fixture.user.id }), 0);
    assert.equal(await entities.E2eeKeyBackup.countBy({ user_id: fixture.user.id }), 0);
    await assert.rejects(invoke(recover, fixture, { password }), (error) => error.code === util.E2eeErrors.NO_BACKUP.code);
});
