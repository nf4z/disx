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

import { randomUUID } from "node:crypto";
import type { ScheduledMessage } from "@spacebar/database";

export const SCHEDULED_MESSAGE_LEASE_MS = 300_000;

type Query = (sql: string, parameters: unknown[]) => Promise<unknown>;

export async function dispatchClaimedScheduledMessage(query: Query, id: string, send: (message: ScheduledMessage) => Promise<number | null>, onlyDue = false) {
    const token = randomUUID();
    const [scheduled] = (await query(
        `WITH claimed AS (UPDATE "scheduled_messages" SET "claim_token" = $2, "claim_until" = now() + $3 * interval '1 millisecond'
        WHERE "id" = $1 AND "state" = 0 AND ("claim_until" IS NULL OR "claim_until" <= now()) ${onlyDue ? `AND "send_at" <= now()` : ""} RETURNING *) SELECT * FROM claimed`,
        [id, token, SCHEDULED_MESSAGE_LEASE_MS],
    )) as ScheduledMessage[];
    if (!scheduled) return false;
    let renewing: Promise<unknown> | undefined;
    const heartbeat = setInterval(() => {
        if (renewing) return;
        renewing = query(`UPDATE "scheduled_messages" SET "claim_until" = now() + $3 * interval '1 millisecond' WHERE "id" = $1 AND "claim_token" = $2`, [
            id,
            token,
            SCHEDULED_MESSAGE_LEASE_MS,
        ])
            .catch((error) => console.error(`[ScheduledMessages] failed to renew delivery lease for ${id}`, error))
            .finally(() => {
                renewing = undefined;
            });
    }, SCHEDULED_MESSAGE_LEASE_MS / 3).unref();
    try {
        const failure = await send(scheduled);
        const completed = (await query(
            failure === null
                ? `WITH completed AS (DELETE FROM "scheduled_messages" WHERE "id" = $1 AND "claim_token" = $2 RETURNING "id") SELECT "id" FROM completed`
                : `WITH completed AS (UPDATE "scheduled_messages" SET "state" = $3, "claim_token" = NULL, "claim_until" = NULL WHERE "id" = $1 AND "claim_token" = $2 RETURNING "id") SELECT "id" FROM completed`,
            failure === null ? [id, token] : [id, token, failure],
        )) as { id: string }[];
        return failure === null && completed.length > 0;
    } finally {
        clearInterval(heartbeat);
        await renewing;
    }
}
