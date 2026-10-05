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

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto");
const hpke = require("@hpke/core");
const load = (file, imports) => {
    const module = { exports: {} };
    vm.runInNewContext(
        ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
            .outputText,
        {
            module,
            exports: module.exports,
            require: (name) => imports[name] ?? require(name),
            process,
            Buffer,
            crypto: crypto.webcrypto,
            TextEncoder,
            TextDecoder,
            Uint8Array,
            ArrayBuffer,
            DataView,
            Blob,
            atob,
            btoa,
        },
    );
    return module.exports;
};
const bytes = load("client/e2ee/src/bytes.ts", {});
const client = load("client/e2ee/src/crypto.ts", { "./bytes": bytes });
const files = load("client/e2ee/src/files.ts", { "./bytes": bytes });
const deviceId = (key) => crypto.createHash("sha256").update(Buffer.from(key, "base64url")).digest().subarray(0, 16).toString("base64url");
const deviceMessage = (u, d, k) => `larpcord-e2ee/v1/device\n${u}\n${d}\n${k}`;
const prekeyMessage = (d, i, k) => `larpcord-e2ee/v1/prekey\n${d}\n${i}\n${k}`;
const backupMessage = (u, k) => `larpcord-e2ee/v1/backup-key\n${u}\n${k}`;
const sign = (key, value) => crypto.sign(null, Buffer.from(value), key).toString("base64url");
async function harness() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "larpcord-system-crypto-"));
    const original = process.env.E2EE_SYSTEM_KEY_DIR;
    process.env.E2EE_SYSTEM_KEY_DIR = dir;
    const identities = new Map(),
        devices = new Map();
    const identityRepo = {
        exists: async ({ where }) => identities.has(where.user_id),
        findOne: async ({ where }) => identities.get(where.user_id),
        insert: async (value) => identities.set(value.user_id, value),
    };
    const deviceRepo = {
        exists: async ({ where }) => [...devices.values()].some((d) => d.user_id === where.user_id),
        findOne: async ({ where }) => devices.get(where.id),
        insert: async (value) => devices.set(value.id, value),
    };
    const entities = {
        E2eeIdentity: identityRepo,
        E2eeDevice: deviceRepo,
        getDatabase: () => ({ transaction: async (fn) => fn({ query: async () => [], getRepository: (entity) => entity }) }),
    };
    const directory = async (ids) =>
        Object.fromEntries(
            ids.map((id) => [
                id,
                {
                    identity_key: identities.get(id)?.public_key,
                    devices: [...devices.values()]
                        .filter((d) => d.user_id === id)
                        .map((d) => ({
                            device_id: d.id,
                            status: d.status,
                            signing_key: d.signing_key,
                            identity_signature: d.identity_signature,
                            prekey: { id: d.prekey_id, public_key: d.prekey_public, signature: d.prekey_signature },
                        })),
                },
            ]),
        );
    const source = () =>
        load("src/api/util/utility/systemEncryption.ts", {
            "@spacebar/database": entities,
            "@spacebar/schemas": { UserFlags: { FLAGS: { SYSTEM: 8n } } },
            "./e2ee": {
                e2eeDeviceId: deviceId,
                e2eeDeviceMessage: deviceMessage,
                e2eePrekeyMessage: prekeyMessage,
                e2eeBackupKeyMessage: backupMessage,
                e2eeLimits: () => ({ maxEnvelopeDevices: 32 }),
                e2eeUserKeys: directory,
            },
        });
    const sender = { id: "1234567890", username: "official", flags: 8 };
    const recipient = "1234567891";
    const identity = crypto.generateKeyPairSync("ed25519"),
        signing = crypto.generateKeyPairSync("ed25519"),
        prekey = crypto.generateKeyPairSync("x25519");
    const pub = (pair) => pair.publicKey.export({ format: "jwk" }).x;
    const id = deviceId(pub(signing));
    identities.set(recipient, { user_id: recipient, public_key: pub(identity) });
    devices.set(id, {
        id,
        user_id: recipient,
        status: "active",
        signing_key: pub(signing),
        identity_signature: sign(identity.privateKey, deviceMessage(recipient, id, pub(signing))),
        prekey_id: 1,
        prekey_public: pub(prekey),
        prekey_signature: sign(signing.privateKey, prekeyMessage(id, 1, pub(prekey))),
    });
    return {
        helper: source(),
        source,
        sender,
        recipient,
        prekey,
        identities,
        devices,
        entities,
        identity,
        signing,
        directory,
        dir,
        cleanup() {
            fs.rmSync(dir, { recursive: true, force: true });
            if (original === undefined) delete process.env.E2EE_SYSTEM_KEY_DIR;
            else process.env.E2EE_SYSTEM_KEY_DIR = original;
        },
    };
}
const ALGORITHM = "x25519-hpke-aes256gcm-ed25519";
async function conversations() {
    const h = await harness();
    const messages = new Map();
    const channelId = "1234567892";
    let recipients = [{ user_id: h.sender.id }, { user_id: h.recipient }];
    let type = 1;
    const db = {
        ...h.entities,
        Message: { findOne: async ({ where }) => messages.get(where.id) },
        Channel: { findOne: async () => ({ id: channelId, type, guild_id: null }) },
        Recipient: { find: async () => recipients },
    };
    db.E2eeDevice.findOne = async ({ where }) => {
        const d = h.devices.get(where.id);
        return d && (!where.user_id || d.user_id === where.user_id) ? d : null;
    };
    const verifyEd25519 = (pub, message, sig) => {
        try {
            return crypto.verify(null, Buffer.from(message), crypto.createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: pub }, format: "jwk" }), Buffer.from(sig, "base64url"));
        } catch {
            return false;
        }
    };
    const decryptor = load("src/api/util/utility/officialConversations.ts", {
        "@spacebar/database": db,
        "@spacebar/schemas": { ChannelType: { DM: 1 } },
        "./systemAccounts": { getSystemAccount: async () => h.sender },
        "./systemEncryption": h.helper,
        "./e2ee": {
            decodeKey: (s, length) => {
                const b = Buffer.from(s, "base64url");
                return b.length === length ? b : null;
            },
            e2eeDeviceId: deviceId,
            e2eeDeviceMessage: deviceMessage,
            e2eeRotationMessage: (u, p, n) => `larpcord-e2ee/v1/identity-rotate\n${u}\n${p}\n${n}`,
            e2eeLimits: () => ({ maxEnvelopeBytes: 65536 }),
            verifyEd25519,
        },
    });
    async function outbound() {
        const id = "1234567893",
            nonce = "1234567894";
        const encrypted = await h.helper.encryptSystemPayload(h.sender, [h.recipient], channelId, nonce, { content: "Official reply" });
        const message = { id, nonce, channel_id: channelId, author_id: h.sender.id, timestamp: new Date(), encrypted };
        messages.set(id, message);
        return message;
    }
    async function inbound() {
        const managed = await h.helper.ensureSystemSender(h.sender);
        const senderDevice = [...h.devices.values()].find((d) => d.user_id === h.recipient);
        const id = "1234567895",
            nonce = "1234567896",
            bind = `n:${nonce}`;
        const aad = `larpcord-e2ee/v1/msg\n${channelId}\n${h.recipient}\n${senderDevice.id}\n${bind}`;
        const key = bytes.randomBytes(32),
            iv = bytes.randomBytes(12);
        const sealed = await client.hpkeSeal(managed.prekeyPublic, key, "larpcord-e2ee/v1/wrap", `${aad}\n${managed.deviceId}`);
        const keys = [{ user_id: h.sender.id, device_id: managed.deviceId, prekey_id: 1, ...sealed }];
        const ct = bytes.toB64u(await client.aesEncrypt(key, iv, bytes.utf8(JSON.stringify({ content: "User reply", attachments: [] })), aad));
        const env = { v: 1, alg: ALGORITHM, sender_device: senderDevice.id, iv: bytes.toB64u(iv), ct, keys };
        const canonical = [
            "larpcord-e2ee/v1/sig",
            channelId,
            h.recipient,
            bind,
            1,
            ALGORITHM,
            senderDevice.id,
            null,
            env.iv,
            ct,
            keys.map((k) => [k.user_id, k.device_id, k.prekey_id, k.enc, k.wrapped]),
        ];
        const signingKey = await client.importSigningJwk(h.signing.privateKey.export({ format: "jwk" }));
        env.sig = await client.sign(signingKey, JSON.stringify(canonical));
        const message = { id, nonce, channel_id: channelId, author_id: h.recipient, timestamp: new Date(), encrypted: env };
        messages.set(id, message);
        return message;
    }
    return {
        ...h,
        messages,
        decrypt: decryptor.decryptOfficialMessage,
        outbound,
        inbound,
        setRecipients: (r) => {
            recipients = r;
        },
        setType: (t) => {
            type = t;
        },
    };
}
test("official inbox reads its outbound message and actual-client-encrypted user reply", async () => {
    const h = await conversations();
    try {
        const outgoing = await h.outbound();
        assert.equal((await h.decrypt(outgoing.id)).content, "Official reply");
        const incoming = await h.inbound();
        assert.equal((await h.decrypt(incoming.id)).content, "User reply");
        assert.ok(!JSON.stringify(incoming).includes("User reply"));
    } finally {
        h.cleanup();
    }
});
test("persisted messages outside the exact official DM cannot be decrypted", async () => {
    const h = await conversations();
    try {
        const msg = await h.inbound();
        h.setRecipients([{ user_id: h.recipient }, { user_id: "1234567899" }]);
        await assert.rejects(h.decrypt(msg.id), /verified/);
        h.setRecipients([{ user_id: h.sender.id }, { user_id: h.recipient }, { user_id: "1234567899" }]);
        await assert.rejects(h.decrypt(msg.id), /verified/);
        h.setRecipients([{ user_id: h.sender.id }, { user_id: h.recipient }]);
        h.setType(3);
        await assert.rejects(h.decrypt(msg.id), /verified/);
        h.setType(1);
        await assert.rejects(h.decrypt("invalid"), /verified/);
        await assert.rejects(h.decrypt("1234567888"), /verified/);
    } finally {
        h.cleanup();
    }
});
test("channel/nonce/mid/author/signature tampering fails before plaintext is returned", async () => {
    const h = await conversations();
    try {
        const msg = await h.inbound();
        const original = JSON.stringify(msg.encrypted);
        for (const [field, value] of [
            ["channel_id", "1234567000"],
            ["nonce", "1234567000"],
            ["author_id", h.sender.id],
        ]) {
            const saved = msg[field];
            msg[field] = value;
            await assert.rejects(h.decrypt(msg.id));
            msg[field] = saved;
        }
        msg.encrypted.sig = "tampered";
        await assert.rejects(h.decrypt(msg.id));
        msg.encrypted = JSON.parse(original);
        msg.encrypted.mid = "1234567000";
        await assert.rejects(h.decrypt(msg.id));
        msg.encrypted = JSON.parse(original);
        msg.encrypted.ct = msg.encrypted.ct.slice(0, -1) + "A";
        await assert.rejects(h.decrypt(msg.id));
    } finally {
        h.cleanup();
    }
});
test("forged sender identity, post-revocation sends and missing managed keys fail closed", async () => {
    const h = await conversations();
    try {
        const msg = await h.inbound();
        const device = [...h.devices.values()].find((d) => d.user_id === h.recipient);
        const signature = device.identity_signature;
        device.identity_signature = "tampered";
        await assert.rejects(h.decrypt(msg.id));
        device.identity_signature = signature;
        device.status = "revoked";
        device.revoked_at = new Date(msg.timestamp.getTime() - 1);
        await assert.rejects(h.decrypt(msg.id));
        device.revoked_at = new Date(msg.timestamp.getTime() + 1);
        assert.equal((await h.decrypt(msg.id)).content, "User reply");
        device.status = "active";
        fs.unlinkSync(path.join(h.dir, `${h.sender.id}.key`));
        await assert.rejects(h.decrypt(msg.id));
        assert.equal(fs.existsSync(path.join(h.dir, `${h.sender.id}.key`)), false);
    } finally {
        h.cleanup();
    }
});
