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
import { userBadgeDirectory } from "@spacebar/api/util/utility/userBadges";

const router: Router = Router({ mergeParams: true });

router.get("/", route({ responses: { 200: {} } }), async (req: Request, res: Response) => {
    const userId = req.params.user_id === "@me" ? req.user_id : (req.params.user_id as string);
    res.json({ badges: await userBadgeDirectory(userId, req.user_id) });
});

router.get("/:badge_id", route({ responses: { 200: {}, 404: {} } }), async (req: Request, res: Response) => {
    const userId = req.params.user_id === "@me" ? req.user_id : (req.params.user_id as string);
    const badge = (await userBadgeDirectory(userId, req.user_id)).find((entry) => String(entry.badge_id) === req.params.badge_id);
    if (!badge) return res.status(404).json({ code: 10083, message: "Unknown Badge" });
    res.json(badge);
});

export default router;
