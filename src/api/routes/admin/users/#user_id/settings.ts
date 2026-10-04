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
import { UserSettings, UserSettingsProtos } from "@spacebar/database";
import { UserSettingsUpdateSchema } from "@spacebar/schemas";
import { updateUserPreferenceSettings } from "@spacebar/api/util/handlers/UserPreferenceSettings";
import { HTTPError } from "lambert-server/HTTPError";
const router = Router({ mergeParams: true });
router.get("/", route({ right: "MANAGE_USERS", spacebarOnly: true }), async (req: Request, res: Response) => {
    const target = await adminCustomizationTarget(req);
    if (target.bot) throw new HTTPError("Bot accounts do not have client preferences", 400);
    const [settings, proto] = await Promise.all([UserSettings.getOrDefault(target.id), UserSettingsProtos.getOrDefault(target.id)]);
    res.json(settings.toLegacy(proto.userSettings));
});
router.patch("/", route({ right: "MANAGE_USERS", spacebarOnly: true, requestBody: "UserSettingsUpdateSchema" }), async (req: Request, res: Response) => {
    const target = await adminCustomizationTarget(req);
    if (target.bot) throw new HTTPError("Bot accounts do not have client preferences", 400);
    const result = await updateUserPreferenceSettings(target.id, req.body as UserSettingsUpdateSchema);
    await recordAdminCustomization(req, target.id, "client_preferences", Object.keys(req.body));
    res.json(result);
});
export default router;
