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
import { adminCustomizationTarget, ADMIN_USER_CUSTOMIZATION_ACTION } from "@spacebar/api/util/handlers/AdminUserCustomization";
import { AuditLog } from "@spacebar/database";
import { IsNull } from "typeorm";
const router = Router({ mergeParams: true });
router.get("/", route({ right: "MANAGE_USERS", spacebarOnly: true }), async (req: Request, res: Response) => {
    const target = await adminCustomizationTarget(req);
    const entries = await AuditLog.find({
        where: { target_id: target.id, guild_id: IsNull(), action_type: ADMIN_USER_CUSTOMIZATION_ACTION },
        order: { id: "DESC" },
        take: 50,
        select: { id: true, user_id: true, target_id: true, options: true, changes: true, reason: true },
    });
    res.json({ entries });
});
export default router;
