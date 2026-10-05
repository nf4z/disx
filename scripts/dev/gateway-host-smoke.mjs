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

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { inflateSync, constants } from "node:zlib";

const { chromium } = createRequire(path.join(homedir(), ".cache/larpcord-tools/package.json"))("playwright-core");
const port = process.env.PORT || "3290";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
try {
    for (const host of [`localhost:${port}`, `larpcord.localhost:${port}`]) {
        const page = await browser.newPage();
        await page.goto(`http://${host}/login`);
        await page.locator('input[name="email"]').waitFor();
        const result = await page.evaluate(() => {
            const gateway = `ws://${location.host}`;
            return { host: location.host, cdn: window.GLOBAL_ENV.CDN_HOST, media: window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT, gateway, initial: window.GLOBAL_ENV.GATEWAY_ENDPOINT, alternate: window.GLOBAL_ENV.GATEWAY_ALT_ENDPOINT, resume: Vencord.Plugins.plugins.LarpCord.gateway() };
        });
        assert.equal(result.cdn, result.host);
        assert.equal(result.media, `//${result.host}`);
        assert.equal(result.initial, result.gateway);
        assert.equal(result.alternate, result.gateway);
        assert.equal(result.resume, result.gateway);
        const bytes = await page.evaluate(
            () =>
                new Promise((resolve, reject) => {
                    const socket = new WebSocket(`${window.GLOBAL_ENV.GATEWAY_ENDPOINT}/?encoding=json&v=9&compress=zlib-stream`);
                    socket.binaryType = "arraybuffer";
                    const timer = setTimeout(() => {
                        socket.close();
                        reject(new Error("Gateway HELLO timeout"));
                    }, 5000);
                    socket.onmessage = (event) => {
                        clearTimeout(timer);
                        socket.close();
                        resolve(Array.from(new Uint8Array(event.data)));
                    };
                    socket.onerror = () => {
                        clearTimeout(timer);
                        reject(new Error("Gateway connect failed"));
                    };
                }),
        );
        assert.equal(JSON.parse(inflateSync(Buffer.from(bytes), { finishFlush: constants.Z_SYNC_FLUSH }).toString()).op, 10);
        console.log(`PASS CDN, media, initial, alternate and reconnect use ${host}; compressed HELLO received`);
        await page.close();
    }
} finally {
    await browser.close();
}
