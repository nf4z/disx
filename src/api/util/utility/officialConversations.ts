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

import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { createDecipheriv, createPrivateKey, createPublicKey, hkdfSync } from "node:crypto";
import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from "@hpke/core";
import { Channel, E2eeDevice, E2eeIdentity, Message, Recipient } from "@spacebar/database";
import { ChannelType } from "@spacebar/schemas";
import { decodeKey, e2eeDeviceId, e2eeDeviceMessage, e2eeLimits, e2eeRotationMessage, verifyEd25519 } from "./e2ee";
import { getSystemAccount } from "./systemAccounts";
import { ensureSystemSender } from "./systemEncryption";

const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const unavailable = () => new Error("Official message could not be verified or decrypted");

export interface OfficialMessagePayload {
    content: string;
    attachments?: { name: string; filename: string; content_type: string; size: number; key: string; iv: string }[];
}

async function officialPrekey(userId: string, expectedPublic: string) {
    const directory = process.env.E2EE_SYSTEM_KEY_DIR || path.join(path.dirname(path.resolve(process.env.CONFIG_PATH || "config.json")), ".e2ee-system");
    const file = await fs.open(path.join(directory, `${userId}.key`), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let seed: Buffer | null = null;
    let secret: Buffer | null = null;
    try {
        const stat = await file.stat();
        if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 128) throw unavailable();
        const value = (await file.readFile("utf8")).trim();
        seed = Buffer.from(value, "base64url");
        if (seed.length !== 32 || seed.toString("base64url") !== value) throw unavailable();
        secret = Buffer.from(hkdfSync("sha256", seed, Buffer.alloc(32), "larpcord-e2ee/v1/system-sender/prekey", 32));
        const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b656e04220420", "hex"), secret]), format: "der", type: "pkcs8" });
        if (createPublicKey(key).export({ format: "jwk" }).x !== expectedPublic) throw unavailable();
        return await suite.kem.deserializePrivateKey(secret);
    } finally {
        seed?.fill(0);
        secret?.fill(0);
        await file.close();
    }
}

export async function decryptOfficialMessage(messageId: string): Promise<OfficialMessagePayload> {
    if (!/^\d{1,20}$/.test(messageId)) throw unavailable();
    const official = await getSystemAccount("official");
    const message = await Message.findOne({ where: { id: messageId } });
    if (!message?.channel_id || !message.author_id || !message.encrypted) throw unavailable();
    const [channel, recipients] = await Promise.all([
        Channel.findOne({ where: { id: message.channel_id }, select: { id: true, type: true, guild_id: true } }),
        Recipient.find({ where: { channel_id: message.channel_id }, select: { user_id: true } }),
    ]);
    const members = recipients.map((recipient) => recipient.user_id);
    if (channel?.type !== ChannelType.DM || channel.guild_id || members.length !== 2 || !members.includes(official.id) || !members.includes(message.author_id)) throw unavailable();
    const env = message.encrypted;
    if (env.v !== 1 || env.alg !== "x25519-hpke-aes256gcm-ed25519" || !Array.isArray(env.keys) || Buffer.byteLength(JSON.stringify(env)) > e2eeLimits().maxEnvelopeBytes)
        throw unavailable();
    if (env.mid ? env.mid !== message.id : !message.nonce) throw unavailable();
    const [device, identity] = await Promise.all([
        E2eeDevice.findOne({ where: { id: env.sender_device, user_id: message.author_id } }),
        E2eeIdentity.findOne({ where: { user_id: message.author_id } }),
    ]);
    if (!device || !identity || e2eeDeviceId(device.signing_key) !== device.id || !device.identity_signature) throw unavailable();
    if (device.status !== "active" && !(device.status === "revoked" && device.revoked_at && message.timestamp < device.revoked_at)) throw unavailable();
    const identityMessage = e2eeDeviceMessage(message.author_id, device.id, device.signing_key);
    const verified =
        verifyEd25519(identity.public_key, identityMessage, device.identity_signature) ||
        (!!identity.previous_key &&
            !!identity.rotation_signature &&
            verifyEd25519(identity.previous_key, e2eeRotationMessage(message.author_id, identity.previous_key, identity.public_key), identity.rotation_signature) &&
            verifyEd25519(identity.previous_key, identityMessage, device.identity_signature));
    if (!verified) throw unavailable();
    const bind = env.mid ? `m:${env.mid}` : `n:${message.nonce}`;
    const signed: unknown[] = [
        "larpcord-e2ee/v1/sig",
        message.channel_id,
        message.author_id,
        bind,
        env.v,
        env.alg,
        env.sender_device,
        env.mid ?? null,
        env.iv,
        env.ct,
        [...env.keys].sort((a, b) => (a.device_id < b.device_id ? -1 : 1)).map((entry) => [entry.user_id, entry.device_id, entry.prekey_id, entry.enc, entry.wrapped]),
    ];
    if (env.backup) signed.push([...env.backup].sort((a, b) => (a.user_id < b.user_id ? -1 : 1)).map((entry) => [entry.user_id, entry.enc, entry.wrapped]));
    if (!verifyEd25519(device.signing_key, JSON.stringify(signed), env.sig)) throw unavailable();
    const managed = await ensureSystemSender(official);
    const target = env.keys.find((entry) => entry.user_id === official.id && entry.device_id === managed.deviceId && entry.prekey_id === 1);
    if (!target || !decodeKey(env.iv, 12) || !decodeKey(target.enc, 32)) throw unavailable();
    const aad = `larpcord-e2ee/v1/msg\n${message.channel_id}\n${message.author_id}\n${env.sender_device}\n${bind}`;
    const recipientKey = await officialPrekey(official.id, managed.prekeyPublic);
    const key = Buffer.from(
        await suite.open(
            { recipientKey, enc: Buffer.from(target.enc, "base64url"), info: Buffer.from("larpcord-e2ee/v1/wrap") },
            Buffer.from(target.wrapped, "base64url"),
            Buffer.from(`${aad}\n${target.device_id}`),
        ),
    );
    try {
        if (key.length !== 32) throw unavailable();
        const ciphertext = Buffer.from(env.ct, "base64url");
        if (ciphertext.length < 16) throw unavailable();
        const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64url"));
        cipher.setAAD(Buffer.from(aad));
        cipher.setAuthTag(ciphertext.subarray(-16));
        const payload = JSON.parse(Buffer.concat([cipher.update(ciphertext.subarray(0, -16)), cipher.final()]).toString("utf8")) as OfficialMessagePayload;
        if (!payload || typeof payload.content !== "string" || (payload.attachments !== undefined && !Array.isArray(payload.attachments))) throw unavailable();
        return payload;
    } finally {
        key.fill(0);
    }
}
