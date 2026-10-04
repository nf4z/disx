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
import { Request, Response, Router } from "express";
import { TrendingGifsResponse } from "@spacebar/schemas";
import { GifProviderManager } from "@spacebar/integrations/gifs";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        query: {
            locale: {
                type: "string",
                description: "Locale",
            },
            provider: {
                type: "string",
                description: "Provider to use",
            },
        },
        responses: {
            200: {
                body: "TrendingGifsResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const provider = GifProviderManager.findProvider(req.query.provider as string);
        if (!provider) return res.status(503).json({ message: "This GIF provider is not configured." });

        const [trendingCategories, trendingGifs] = await Promise.all([
            provider.getTrendingCategories(req.query as typeof provider.getTrendingCategories.arguments).catch(() => null),
            provider.getTrendingGifs(req.query as typeof provider.getTrendingGifs.arguments).catch(() => null),
        ]);

        if (trendingCategories === null || trendingGifs === null) return res.status(502).json({ message: "The GIF provider is temporarily unavailable." });
        res.json({
            categories: trendingCategories,
            gifs: trendingGifs,
        } satisfies TrendingGifsResponse);
    },
);

export default router;
