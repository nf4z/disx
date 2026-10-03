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
import { Guild, Role } from "@spacebar/database";
import { Permissions } from "@spacebar/util";
const router = Router({ mergeParams: true });
router.get("/", route({ right: "MANAGE_GUILDS", spacebarOnly: true, description: "List server roles and available permission flags" }), async (req: Request, res: Response) => {
    const guild_id = req.params.guild_id as string;
    await Guild.findOneOrFail({ where: { id: guild_id }, select: { id: true } });
    res.json({
        roles: await Role.find({ where: { guild_id }, order: { position: "DESC" }, take: 1000 }),
        permissions: Object.entries(Permissions.FLAGS).map(([name, value]) => ({ name, value: value.toString() })),
    });
});
export default router;
