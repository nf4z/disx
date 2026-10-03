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

import { Request, Response, Router } from "express";
import { route } from "@spacebar/api/middlewares";
import { THREAD_TYPES } from "@spacebar/api/util";
import { In, Not } from "typeorm";
import { Channel, Guild } from "@spacebar/database";
const router = Router({ mergeParams: true });
router.get("/", route({ right: "MANAGE_GUILDS", spacebarOnly: true, description: "List a server's channels for instance management" }), async (req: Request, res: Response) => {
    const guild_id = req.params.guild_id as string;
    const guild = await Guild.findOneOrFail({ where: { id: guild_id }, select: { id: true, channel_ordering: true } });
    const channels = await Channel.find({
        where: { guild_id, type: Not(In(THREAD_TYPES)) },
        select: { id: true, name: true, topic: true, type: true, parent_id: true, nsfw: true, rate_limit_per_user: true },
        take: 1000,
        order: { id: "ASC" },
    });
    const positions = new Map(guild.channel_ordering.map((id, index) => [id, index]));
    channels.sort((a, b) => (positions.get(a.id) ?? 100000) - (positions.get(b.id) ?? 100000));
    res.json({
        channels: channels.map((channel) => ({
            id: channel.id,
            name: channel.name,
            topic: channel.topic ?? null,
            type: channel.type,
            parent_id: channel.parent_id,
            nsfw: channel.nsfw,
            rate_limit_per_user: channel.rate_limit_per_user ?? 0,
        })),
        truncated: channels.length === 1000,
    });
});
export default router;
