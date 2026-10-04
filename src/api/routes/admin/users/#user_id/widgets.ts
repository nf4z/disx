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
import { adminCustomizationTarget, recordAdminCustomization } from "@spacebar/api/util/handlers/AdminUserCustomization";
import { User, getDatabase } from "@spacebar/database";
import { validateProfileWidgetSelection } from "@spacebar/api/util/handlers/ProfileWidgetSelection";
import { broadcastUserUpdate } from "@spacebar/util";
const router = Router({ mergeParams: true });
router.get("/", route({ right: "MANAGE_USERS", spacebarOnly: true }), async (req: Request, res: Response) => {
    const target = await adminCustomizationTarget(req);
    const user = await User.findOneOrFail({ where: { id: target.id }, select: { id: true, profile_widgets: true } });
    res.json({ widgets: user.profile_widgets || [] });
});
router.put("/", route({ right: "MANAGE_USERS", spacebarOnly: true }), async (req: Request, res: Response) => {
    const target = await adminCustomizationTarget(req);
    const widgets = await validateProfileWidgetSelection(target.id, req.body?.widgets);
    await getDatabase()!.transaction(async (manager) => {
        await manager.update(User, { id: target.id }, { profile_widgets: widgets });
        await recordAdminCustomization(req, target.id, "profile_widgets", ["profile_widgets"], manager);
    });
    await broadcastUserUpdate(target.id);
    res.json({ widgets });
});
export default router;
