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

const playwright = createRequire(path.join(homedir(), ".cache/larpcord-tools/package.json"))("playwright-core");

export async function solveCap({ origin = process.env.ORIGIN || `http://localhost:${process.env.PORT || 3290}`, browser: providedBrowser } = {}) {
    const browser =
        providedBrowser ||
        (await playwright.chromium.launch({
            executablePath: process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            headless: true,
        }));
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        const configResponse = await page.goto(`${origin}/api/v9/auth/captcha`);
        assert.equal(configResponse.status(), 200);
        const config = await configResponse.json();
        if (!config.register) return undefined;
        assert.equal(config.service, "cap");
        assert.ok(config.endpoint);
        await page.setContent("<!doctype html><html><body><main><h1>Account verification</h1></main></body></html>");
        await page.evaluate(() => {
            window.CAP_CUSTOM_WASM_URL = "/api/v9/auth/cap/cap_wasm_bg.wasm";
            window.CAP_CUSTOM_HASHWX_URL = "/api/v9/auth/cap/hashwx.wasm";
            window.CAP_PAKO_URL = "/api/v9/auth/cap/pako.js";
            window.CAP_DISABLE_WIDGET_REF = true;
        });
        await page.addScriptTag({ url: `${origin}/api/v9/auth/cap/widget.js` });
        await page.evaluate(async (endpoint) => {
            await customElements.whenDefined("cap-widget");
            const widget = document.createElement("cap-widget");
            widget.setAttribute("data-cap-api-endpoint", endpoint);
            widget.addEventListener("solve", (event) => {
                window.larpcordCapToken = event.detail.token;
            });
            widget.addEventListener("error", () => {
                window.larpcordCapError = true;
            });
            document.querySelector("main").append(widget);
        }, config.endpoint);
        await page.locator("cap-widget").getByRole("button", { name: "Click to verify you're a human" }).click();
        await page.waitForFunction(() => window.larpcordCapToken || window.larpcordCapError, { timeout: 60000 });
        const token = await page.evaluate(() => window.larpcordCapToken);
        assert.ok(typeof token === "string" && token.length > 0, "Cap challenge completed in a real browser");
        return token;
    } finally {
        await context.close();
        if (!providedBrowser) await browser.close();
    }
}
