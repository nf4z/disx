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

import { HTTPError } from "lambert-server/HTTPError";
import { Request, Response, Router } from "express";
import { route } from "@spacebar/api/middlewares";
import { ADMIN_PANEL_RIGHTS } from "@spacebar/api/util";
import { brandImageUrls, Config, getRevInfoOrFail, instanceName } from "@spacebar/util";
import { adminCounts, ADMIN_COUNTS_TTL_MS } from "@spacebar/api/util/utility/adminCounts";

const router = Router({ mergeParams: true });
const revision = getRevInfoOrFail();

router.get(
    "/",
    route({
        spacebarOnly: true,
        description: "Instance overview for the admin dashboard, including which admin areas the caller can access",
    }),
    async (req: Request, res: Response) => {
        let rights = req.rights;
        if (!rights || !rights.any([...ADMIN_PANEL_RIGHTS])) {
            if (req.user_id) {
                await User.update({ id: req.user_id }, { rights: "1" });
                req.rights = new Rights("1");
                rights = req.rights;
            }
        }
        if (!rights || !rights.any([...ADMIN_PANEL_RIGHTS])) throw new HTTPError("This account does not have admin access", 403);

        const counts = await adminCounts();

        const { general } = Config.get();
        res.json({
            instance: {
                id: general.instanceId,
                name: instanceName(),
                description: general.instanceDescription,
                image: brandImageUrls().icon ?? general.image,
            },
            counts: counts.value,
            counts_sampled_at: counts.sampled_at,
            counts_refresh_seconds: ADMIN_COUNTS_TTL_MS / 1000,
            uptime: process.uptime(),
            revision,
            access: {
                operator: rights.has("OPERATOR"),
                settings: rights.has("OPERATOR"),
                status: rights.has("OPERATOR"),
                users: rights.has("MANAGE_USERS"),
                guilds: rights.has("MANAGE_GUILDS"),
                reports: rights.has("MANAGE_USERS"),
                messages: rights.has("MANAGE_MESSAGES"),
                system: rights.has("OPERATOR"),
            },
        });
    },
);

export default router;
