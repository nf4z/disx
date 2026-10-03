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
import { getDatabase } from "@spacebar/database";
import { Monitoring } from "../../../../util/monitoring/Monitoring";

const router = Router({ mergeParams: true });
router.get(
    "/",
    route({ right: "OPERATOR", spacebarOnly: true, description: "Process memory, event loop delay and HTTP route timings since startup" }),
    async (req: Request, res: Response) => {
        const started = performance.now();
        const database = await getDatabase()
            ?.query("SELECT 1")
            .then(
                () => ({ connected: true, round_trip_ms: performance.now() - started }),
                () => ({ connected: false, round_trip_ms: performance.now() - started }),
            );
        res.set("Cache-Control", "no-store").json({ ...(await Monitoring.snapshot()), database: database ?? { connected: false, round_trip_ms: null } });
    },
);
export default router;
