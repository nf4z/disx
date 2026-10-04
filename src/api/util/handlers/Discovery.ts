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

import { Guild, Member } from "@spacebar/database";
import { Config } from "@spacebar/util";

// The rules every Discovery list follows, so the home page, the category pages, search and recommendations agree.

export const DISCOVERY_MAX_LIMIT = 48;

export function discoveryPage(query: { offset?: unknown; limit?: unknown }, defaultLimit = Config.get().guild.discovery.limit || 24) {
    const offset = Math.min(Math.max(Math.floor(Number(query.offset ?? Config.get().guild.discovery.offset)) || 0, 0), 10_000);
    const limit = Math.min(Math.max(Math.floor(Number(query.limit ?? defaultLimit)) || defaultLimit, 1), DISCOVERY_MAX_LIMIT);
    return { offset, limit };
}

// ?categories=1, ?categories=1,2 and ?categories=1&categories=2 all work
export function discoveryCategories(raw: unknown) {
    const ids = (Array.isArray(raw) ? raw : [raw])
        .flatMap((value) => String(value ?? "").split(","))
        .filter((value) => value.trim() !== "")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0);
    return [...new Set(ids)];
}

export async function hiddenDiscoveryGuildIds(userId: string) {
    if (!Config.get().guild.discovery.hideJoinedGuilds) return [];
    return (await Member.find({ where: { id: userId }, select: { guild_id: true } })).map((member) => member.guild_id);
}

export async function toDiscoveryList(guilds: Guild[]) {
    const showAll = Config.get().guild.discovery.showAllGuilds;
    return (await Promise.all(guilds.map((guild) => guild.toDiscoverableGuild(showAll)))).filter((guild) => guild !== null);
}
