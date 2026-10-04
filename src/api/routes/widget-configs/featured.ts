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
import { In } from "typeorm";
import { route } from "@spacebar/api/middlewares";
import { ApplicationIdentity } from "@spacebar/database";
import { toPublicApplication } from "@spacebar/api/util/handlers/Application";
import { findWidgetApplications, toClientWidgetConfig } from "@spacebar/api/util/handlers/ApplicationWidgets";

const router = Router({ mergeParams: true });

// The widgets offered in the client's Add Widget picker: your own, the ones apps have data for you in, and public ones.
router.get("/", route({ responses: { 200: {} } }), async (req: Request, res: Response) => {
    const linked = (await ApplicationIdentity.find({ where: { user_id: req.user_id }, select: { application_id: true } })).map((x) => x.application_id);
    const apps = await findWidgetApplications([{ owner_id: req.user_id }, { widget_public: true }, ...(linked.length ? [{ id: In(linked) }] : [])]);
    res.json({ applications: apps.map(toPublicApplication), configs: Object.fromEntries(apps.map((app) => [app.id, [toClientWidgetConfig(app, req.user_id)]])) });
});

export default router;
