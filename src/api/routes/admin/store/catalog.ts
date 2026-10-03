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
import { Collectibles, CollectibleProduct } from "@spacebar/util";
const router = Router({ mergeParams: true });
router.get(
    "/",
    route({ right: "MANAGE_USERS", spacebarOnly: true, description: "Compact local catalog for choosing profile cosmetics in the admin dashboard" }),
    async (req: Request, res: Response) => {
        const items = new Map<string, { sku_id: string; name: string; type: number; asset: string | null; pack: string }>();
        const visit = (product: CollectibleProduct, pack: string) => {
            for (const item of product.items ?? []) items.set(item.sku_id, { sku_id: item.sku_id, name: product.name, type: item.type, asset: item.asset ?? null, pack });
            for (const child of [...(product.bundled_products ?? []), ...(product.variants ?? [])]) visit(child, pack);
        };
        const packs = new Map([...(await Collectibles.builtinCategories()), ...(await Collectibles.categories())].map((pack) => [pack.sku_id, pack]));
        for (const pack of packs.values()) for (const product of pack.products) visit(product, pack.name);
        res.json({ items: [...items.values()] });
    },
);
export default router;
