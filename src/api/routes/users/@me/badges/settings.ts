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
import { route } from "@spacebar/api/middlewares";
import { User } from "@spacebar/database";
import { UserBadgeSettingsSchema } from "@spacebar/schemas";
import { broadcastUserUpdate, sanitizeBadgeSettings } from "@spacebar/util";

const router: Router = Router({ mergeParams: true });

// hide and reorder profile badges (Customize Badges in the profile editor)
router.patch("/", route({ requestBody: "UserBadgeSettingsSchema", responses: { 200: {}, 400: { body: "APIErrorResponse" } } }), async (req: Request, res: Response) => {
    const user = await User.findOneOrFail({ where: { id: req.user_id }, select: { id: true, badge_settings: true } });
    const settings = sanitizeBadgeSettings(req.body as UserBadgeSettingsSchema, user.badge_settings);
    await User.update({ id: req.user_id }, { badge_settings: settings });
    await broadcastUserUpdate(req.user_id);
    res.json(settings);
});

export default router;
