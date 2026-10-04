/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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
const path = require("node:path");
const Module = require("node:module");
const { buildSync } = require("esbuild");
const root = path.resolve(__dirname, "../..");
const result = buildSync({
    stdin: {
        contents:
            'export {Engine,FALLBACK_CONTENT} from "./client/e2ee/src/engine"; export {createHooks} from "./client/e2ee/src/hooks"; export {generateSigningKey,generateAgreementKey,exportPublic,sign,deviceIdFor,deviceMessage,prekeyMessage} from "./client/e2ee/src/crypto";',
        resolveDir: root,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
});
const compiled = new Module(path.join(root, "scripts/tests/private-e2ee-fixture.cjs"), module);
compiled.filename = compiled.id;
compiled.paths = module.paths;
compiled._compile(result.outputFiles[0].text, compiled.filename);
const { Engine, FALLBACK_CONTENT, createHooks, generateSigningKey, generateAgreementKey, exportPublic, sign, deviceIdFor, deviceMessage, prekeyMessage } = compiled.exports;
global.document = { documentElement: { lang: "en" } };

const fixture = (ready, encryptedChannel = "10") => {
    const calls = [];
    const engine = new Engine(
        {
            request: async () => {
                throw new Error("Unexpected key API");
            },
        },
        (id) => id === encryptedChannel,
    );
    const encryptedPayloads = [];
    engine.encrypt = async (id, payload) => {
        encryptedPayloads.push({ id, payload });
        return { ct: "sealed-fixture", sig: "fixture-signature" };
    };
    const http = Object.fromEntries(
        ["get", "post", "put", "patch", "del"].map((method) => [
            method,
            async (options) => {
                calls.push({ method, options });
                return { ok: true, status: 200, body: {} };
            },
        ]),
    );
    const hooks = createHooks({
        engine,
        ready,
        attachments: { sent: () => {} },
        states: new Map(),
        sticker: () => null,
        failClosed: () => false,
        isReady: () => true,
        onState: () => {},
        updateRecord: () => {},
        onCredentials: () => {},
        onLogout: () => {},
        onError: () => {},
    });
    hooks.wrapHttp(http);
    return { engine, calls, encryptedPayloads, http };
};

test("a first private message waits for bootstrap and reaches HTTP only as an encrypted envelope", async () => {
    let finish;
    const ready = new Promise((resolve) => {
        finish = resolve;
    });
    const { http, calls, encryptedPayloads, engine } = fixture(ready);
    assert.equal(engine.encryptedChannels.size, 0);
    const input = { url: "/channels/10/messages", body: { content: "private first draft", nonce: "123" } };
    const sending = http.post(input);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 0);
    finish(true);
    await sending;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.body.content, FALLBACK_CONTENT);
    assert.equal(calls[0].options.body.encrypted.ct, "sealed-fixture");
    assert.equal(encryptedPayloads[0].payload.content, "private first draft");
    assert.equal(input.body.content, "private first draft");
});

test("bootstrap failure never forwards a private draft to HTTP", async () => {
    const { http, calls } = fixture(Promise.resolve(false));
    await assert.rejects(http.post({ url: "/channels/10/messages", body: { content: "must stay private" } }), (error) => error.code === "NOT_READY");
    assert.equal(calls.length, 0);
});

test("a newly opened private channel encrypts immediately without waiting for an encryption update event", async () => {
    const { http, calls, engine } = fixture(Promise.resolve(true));
    assert.equal(engine.encryptedChannels.size, 0);
    await http.post({ url: "/channels/10/messages", body: { content: "new conversation" } });
    assert.equal(calls[0].options.body.content, FALLBACK_CONTENT);
    assert.ok(calls[0].options.body.encrypted);
});

test("ordinary guild messages retain their existing send behavior", async () => {
    const { http, calls, encryptedPayloads } = fixture(Promise.resolve(false));
    await http.post({ url: "/channels/20/messages", body: { content: "guild message" } });
    assert.equal(calls[0].options.body.content, "guild message");
    assert.equal(calls[0].options.body.encrypted, undefined);
    assert.equal(encryptedPayloads.length, 0);
});

test("explicit encrypted channels stay protected when native channel metadata is unavailable", () => {
    const engine = new Engine({ request: async () => {} }, () => false);
    engine.setChannelEncrypted("30");
    assert.equal(engine.isEncrypted("30"), true);
    assert.equal(engine.isEncrypted("40"), false);
});

const directoryFixture = async (trustsServer, corruptSignature = false) => {
    const previous = await generateSigningKey();
    const identity = await generateSigningKey();
    const deviceKey = await generateSigningKey();
    const agreement = await generateAgreementKey();
    const previousKey = await exportPublic(previous.publicKey);
    const identityKey = await exportPublic(identity.publicKey);
    const signingKey = await exportPublic(deviceKey.publicKey);
    const deviceId = await deviceIdFor(signingKey);
    const publicKey = await exportPublic(agreement.publicKey);
    const keys = {
        identity_key: identityKey,
        devices: [
            {
                device_id: deviceId,
                signing_key: signingKey,
                status: "active",
                name: "Signed-in browser",
                identity_signature: corruptSignature ? "invalid-signature" : await sign(identity.privateKey, deviceMessage("peer", deviceId, signingKey)),
                prekey: { id: 1, public_key: publicKey, signature: await sign(deviceKey.privateKey, prekeyMessage(deviceId, 1, publicKey)) },
            },
        ],
    };
    const engine = new Engine(
        { request: async () => ({ users: { peer: keys } }) },
        () => true,
        () => trustsServer,
    );
    engine.userId = "local-user";
    engine.store = { set: async () => {}, get: async () => undefined, del: async () => {} };
    engine.contacts.peer = { identityKey: previousKey, verified: true, pendingKey: null, firstSeen: Date.now() };
    return { engine, previousKey, identityKey };
};

test("trusted-server mode accepts a directory change and retains historical keys after validating device signatures", async () => {
    const { engine, previousKey, identityKey } = await directoryFixture(true);
    const [entry] = await engine.keysFor(["peer"]);
    assert.equal(entry.identityChanged, false);
    assert.equal(entry.devices.length, 1);
    assert.equal(engine.contacts.peer.identityKey, identityKey);
    assert.equal(engine.contacts.peer.pendingKey, null);
    assert.equal(engine.contacts.peer.verified, false);
    assert.deepEqual(engine.contacts.peer.previousKeys, [previousKey]);
});

test("advanced strict safety checks keep an unsigned directory change pending", async () => {
    const { engine, previousKey, identityKey } = await directoryFixture(false);
    const [entry] = await engine.keysFor(["peer"]);
    assert.equal(entry.identityChanged, true);
    assert.equal(engine.contacts.peer.identityKey, previousKey);
    assert.equal(engine.contacts.peer.pendingKey, identityKey);
});

test("trusted-server mode still rejects devices with invalid identity signatures", async () => {
    const { engine } = await directoryFixture(true, true);
    const [entry] = await engine.keysFor(["peer"]);
    assert.equal(entry.devices.length, 0);
});
