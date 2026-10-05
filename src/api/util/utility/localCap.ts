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

import { createHash, createHmac } from "node:crypto";
import { RateLimit } from "@spacebar/database";
import { Config } from "@spacebar/util";
import type { ValidateChallengeBody } from "capjs-core";

const scope = "larpcord-registration";
const tokenKey = (token: string) => `cap-token:${createHash("sha256").update(token).digest("hex")}`;
const signingKey = () => createHmac("sha256", Config.get().security.requestSignature).update(scope).digest("hex");

export async function createRegistrationChallenge() {
    const { generateChallenge } = await import("capjs-core");
    return generateChallenge(signingKey(), { scope, instrumentation: { blockAutomatedBrowsers: false, obfuscationLevel: 1 }, expiresMs: 300_000 });
}

export async function redeemRegistrationChallenge(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body) || JSON.stringify(body).length > 16_384) return { success: false, reason: "invalid_body" };
    const { validateChallenge } = await import("capjs-core");
    const result = await validateChallenge(signingKey(), body as ValidateChallengeBody, {
        scope,
        tokenTtlMs: 300_000,
        consumeNonce: async (signature, ttl) => {
            const rows = await RateLimit.query(
                `INSERT INTO rate_limits (id, executor_id, hits, blocked, expires_at) VALUES ($1, 'cap', 0, false, $2)
                 ON CONFLICT (id) DO NOTHING RETURNING id`,
                [`cap-nonce:${signature}`, new Date(Date.now() + ttl)],
            );
            return rows.length === 1;
        },
    });
    if (!result.success) return { success: false, reason: result.reason };
    await RateLimit.query(`INSERT INTO rate_limits (id, executor_id, hits, blocked, expires_at) VALUES ($1, 'cap', 0, false, $2)`, [
        tokenKey(result.token),
        new Date(result.expires),
    ]);
    return { success: true, token: result.token, expires: result.expires };
}

export async function consumeRegistrationToken(token: string) {
    if (!token || token.length > 512) return false;
    const [rows] = await RateLimit.query(`DELETE FROM rate_limits WHERE id = $1 AND expires_at > $2 RETURNING id`, [tokenKey(token), new Date()]);
    return rows.length === 1;
}

export async function registrationTokenAvailable(token: string) {
    if (!token || token.length > 512) return false;
    const rows = await RateLimit.query(`SELECT 1 FROM rate_limits WHERE id = $1 AND expires_at > $2 LIMIT 1`, [tokenKey(token), new Date()]);
    return rows.length === 1;
}
