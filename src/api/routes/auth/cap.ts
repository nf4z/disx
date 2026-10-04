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

import { Router } from "express";
import path from "node:path";
import { createHash } from "node:crypto";
import { RateLimit } from "@spacebar/database";
import { route } from "@spacebar/api/middlewares";
import { createRegistrationChallenge, redeemRegistrationChallenge } from "@spacebar/api/util/utility/localCap";

const router = Router();
const widgetRoot = path.dirname(require.resolve("@cap.js/widget"));
const wasmRoot = path.resolve(path.dirname(require.resolve("@cap.js/wasm")), "../browser");
const assets = new Map([
    ["widget.js", path.join(widgetRoot, "cap.min.js")],
    ["wasm-hashes.min.js", path.join(widgetRoot, "wasm-hashes.min.js")],
    ["cap_wasm_bg.wasm", path.join(wasmRoot, "cap_wasm_bg.wasm")],
    ["hashwx.wasm", path.join(wasmRoot, "hashwx.wasm")],
    ["pako.js", path.resolve(path.dirname(require.resolve("pako")), "dist/pako_inflate.min.js")],
]);

router.get("/:asset", route({ authentication: "never" }), (req, res) => {
    const asset = assets.get(String(req.params.asset));
    if (!asset) return res.sendStatus(404);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(asset);
});

for (const action of ["challenge", "redeem"] as const) {
    router.post(`/${action}`, route({ authentication: "never" }), async (req, res) => {
        const ipKey = require("node:crypto")
            .createHash("sha256")
            .update(req.ip || "unknown")
            .digest("hex");
        const limit = await RateLimit.hit(`cap-request:${action}:${ipKey}`, "cap", 30, 60);
        if (limit.hits > 30) {
            res.setHeader("Retry-After", Math.max(1, Math.ceil((limit.expires_at.getTime() - Date.now()) / 1000)));
            return res.status(429).json({ success: false, reason: "rate_limited" });
        }
        res.setHeader("Cache-Control", "no-store");
        return res.json(action === "challenge" ? await createRegistrationChallenge() : await redeemRegistrationChallenge(req.body));
    });
}

export default router;
