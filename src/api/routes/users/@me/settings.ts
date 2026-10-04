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
import { UserSettings, UserSettingsProtos } from "@spacebar/database";
import { UserSettingsUpdateSchema } from "@spacebar/schemas";
import { updateUserPreferenceSettings } from "@spacebar/api/util/handlers/UserPreferenceSettings";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "UserSettings",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const [settings, protos] = await Promise.all([UserSettings.getOrDefault(req.user_id), UserSettingsProtos.getOrDefault(req.user_id)]);
        return res.json(settings.toLegacy(protos.userSettings));
    },
);

router.patch(
    "/",
    route({
        requestBody: "UserSettingsUpdateSchema",
        responses: {
            200: {
                body: "UserSettings",
            },
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        if (!req.body) return res.status(400).json({ code: 400, message: "Invalid request body" });
        res.json(await updateUserPreferenceSettings(req.user_id, req.body as UserSettingsUpdateSchema));
    },
);

export default router;
