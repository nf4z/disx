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
import { findWidgetApplications } from "@spacebar/api/util/handlers/ApplicationWidgets";
import { DiscordApiErrors } from "@spacebar/util";

const router = Router({ mergeParams: true });

// Widget data is pushed by the application and read on every profile fetch, so there's nothing to refresh.
router.post("/", route({ responses: { 204: {}, 404: { body: "APIErrorResponse" } } }), async (req: Request, res: Response) => {
    const [app] = await findWidgetApplications({ id: req.params.application_id as string }, 1);
    if (!app) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    res.sendStatus(204);
});

export default router;
