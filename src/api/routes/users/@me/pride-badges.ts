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

import { route } from "@spacebar/api/middlewares";
import { PRIDE_BADGES } from "@spacebar/api/util/utility/prideBadges";
import { User } from "@spacebar/database";
import { PrideBadgesSchema } from "@spacebar/schemas";
import { broadcastUserUpdate, FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

router.get("/", route({ responses: { 200: {} } }), async (req: Request, res: Response) => {
    const user = await User.findOneOrFail({ where: { id: req.user_id }, select: { id: true, pride_badges: true } });
    res.json({ flags: user.pride_badges ?? [], catalog: PRIDE_BADGES });
});

router.patch("/", route({ requestBody: "PrideBadgesSchema", responses: { 200: {}, 400: { body: "APIErrorResponse" } } }), async (req: Request, res: Response) => {
    const { flags } = req.body as PrideBadgesSchema;
    if (!Array.isArray(flags) || flags.length > PRIDE_BADGES.length || flags.some((slug) => typeof slug !== "string" || !PRIDE_BADGES.some((badge) => badge.slug === slug)))
        throw FieldErrors({ flags: { code: "BASE_TYPE_INVALID", message: "Choose flags from the pride badge catalog." } });
    const selected = [...new Set(flags)];
    const result = await User.createQueryBuilder()
        .update(User)
        .set({ pride_badges: selected })
        .where("id = :user_id", { user_id: req.user_id })
        .andWhere("pride_badges IS DISTINCT FROM :selected::text[]", { selected })
        .execute();
    if (result.affected) await broadcastUserUpdate(req.user_id, selected);
    res.json({ flags: selected, catalog: PRIDE_BADGES });
});

export default router;
