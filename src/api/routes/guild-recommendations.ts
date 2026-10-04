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

import { Request, Response, Router } from "express";
import { ArrayContains, In, Not } from "typeorm";
import { route } from "@spacebar/api/middlewares";
import { Guild } from "@spacebar/database";
import { Config } from "@spacebar/util";
import { discoveryPage, hiddenDiscoveryGuildIds, toDiscoveryList } from "@spacebar/api/util/handlers/Discovery";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "GuildRecommendationsResponse",
            },
        },
        spacebarOnly: false, // Not part of public openapi schema
    }),
    async (req: Request, res: Response) => {
        const { limit } = discoveryPage({ limit: req.query.limit }, 24);
        const hidden = await hiddenDiscoveryGuildIds(req.user_id);

        const genLoadId = (size: number) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");

        const guilds = await Guild.find({
            where: {
                ...(hidden.length ? { id: Not(In(hidden)) } : {}),
                discovery_excluded: false,
                ...(Config.get().guild.discovery.showAllGuilds ? {} : { features: ArrayContains(["DISCOVERABLE"]) }),
            },
            order: { discovery_weight: "DESC", member_count: "DESC", id: "ASC" },
            take: limit,
        });
        res.status(200).send({
            recommended_guilds: await toDiscoveryList(guilds),
            load_id: `server_recs/${genLoadId(32)}`,
        });
    },
);

export default router;
