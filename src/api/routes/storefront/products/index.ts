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

import { route } from "@spacebar/api/middlewares";
import { Collectibles } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

router.get("/", route({}), async (req: Request, res: Response) => {
    let skuIds: string[] = [];
    const query = req.query as Record<string, unknown>;
    const rawIds = query.sku_ids ?? query.product_ids;
    if (Array.isArray(rawIds)) {
        skuIds = rawIds.flatMap((x) => String(x).split(",")).filter(Boolean);
    } else if (typeof rawIds === "string") {
        skuIds = rawIds.split(",").filter(Boolean);
    }

    const products = await Collectibles.storefrontProducts(skuIds);
    res.json({ products });
});

export default router;
