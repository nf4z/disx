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

import crypto from "node:crypto";
import { Request, Response, Router } from "express";
import { route } from "@spacebar/api/middlewares";
import { getApexExperiments, Snowflake } from "@spacebar/util";

const router = Router({ mergeParams: true });

// installation experiments are keyed by the client's installation id; a client without one is given one here
router.get("/", route({ authentication: "optional" }), (req: Request, res: Response) => {
    const header = req.headers["x-installation-id"];
    const known = typeof header === "string" && /^[\w.-]{1,128}$/.test(header) ? header : undefined;
    const installation = known ?? `${Snowflake.generate()}.${crypto.randomBytes(20).toString("base64url")}`;
    res.json({ ...(known ? {} : { installation }), ...getApexExperiments(req.user_id, { installationId: installation }) });
});

export default router;
