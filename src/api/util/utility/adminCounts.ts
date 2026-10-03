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

import { Guild, Member, Message, Report, RESOLVED_INCIDENT_STATES, StatusIncident, User } from "@spacebar/database";
import { In, Not } from "typeorm";

export const ADMIN_COUNTS_TTL_MS = 30000;
export function cachedAsync<T>(load: () => Promise<T>, ttl: number, now = Date.now) {
    let cached: { value: T; sampled_at: string; expires: number } | undefined;
    let pending: Promise<{ value: T; sampled_at: string; expires: number }> | undefined;
    return async () => {
        if (cached && now() < cached.expires) return cached;
        if (!pending) {
            pending = load()
                .then((value) => {
                    const sampled = now();
                    return (cached = { value, sampled_at: new Date(sampled).toISOString(), expires: sampled + ttl });
                })
                .finally(() => {
                    pending = undefined;
                });
        }
        return pending;
    };
}

export const adminCounts = cachedAsync(async () => {
    const [users, guilds, messages, members, disabled_users, open_incidents, open_reports] = await Promise.all([
        User.count({ where: { bot: false } }),
        Guild.count(),
        Message.count(),
        Member.count(),
        User.count({ where: { disabled: true } }),
        StatusIncident.count({ where: { status: Not(In(RESOLVED_INCIDENT_STATES)) } }),
        Report.count({ where: { status: "open" } }),
    ]);
    return { users, guilds, messages, members, disabled_users, open_incidents, open_reports };
}, ADMIN_COUNTS_TTL_MS);
