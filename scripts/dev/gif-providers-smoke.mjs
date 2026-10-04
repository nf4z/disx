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
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
const require = createRequire(`${homedir()}/.cache/fosscord-tools/`);
const { chromium } = require("playwright-core");
const origin = `http://fosscord.localhost:${process.env.PORT || 3290}`;
const account = Object.fromEntries(
    readFileSync(process.env.TEST_ACCOUNT_FILE || new URL("./.test-account", import.meta.url), "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
);
const login = await fetch(`${origin}/api/v9/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: account.TEST_EMAIL, password: account.TEST_PASSWORD }),
});
assert.equal(login.status, 200);
const { token } = await login.json();
const api = async (route, method = "GET", body) => {
    const response = await fetch(`${origin}/api/v9${route}`, {
        method,
        headers: { authorization: token, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
};
const before = await api("/admin/gifs");
assert.equal(before.status, 200);
assert.equal("apiKey" in before.body.klipy, false);
assert.equal("apiKeyPath" in before.body.klipy, false);
assert.equal((await api("/admin/gifs", "PATCH", { defaultProvider: "invalid" })).status, 400);
assert.equal((await api("/gifs/providers")).body.defaultProvider, before.body.defaultProvider);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
    const context = await browser.newContext();
    await context.addInitScript((value) => localStorage.setItem("token", JSON.stringify(value)), token);
    const page = await context.newPage();
    await page.goto(`${origin}/admin/#/settings`);
    await page.locator("#gif-save").waitFor({ timeout: 30000 });
    assert.equal(await page.locator("#gif-klipy-key").inputValue(), "");
    assert.equal(await page.locator("#gif-klipy-key").getAttribute("type"), "password");
    await page.locator("#gif-save").click();
    await page.getByText("GIF settings saved", { exact: true }).waitFor();
    await page.goto(`${origin}/channels/@me`);
    await page.getByRole("button", { name: "User Settings", exact: true }).waitFor({ timeout: 45000 });
    await page.getByText("All", { exact: true }).first().click();
    await page.locator("[class*=peopleListItem]").first().dblclick();
    await page.screenshot({ path: "/tmp/fosscord-gif-picker-before.png" });
    await page.getByRole("button", { name: /GIF/i }).click();
    const selector = page.getByRole("combobox", { name: "GIF provider", exact: true });
    await selector.waitFor();
    await selector.selectOption("tenor");
    const responsePromise = page.waitForResponse((response) => response.url().includes("/gifs/search?") && response.url().includes("provider=tenor"));
    await page.getByRole("textbox").last().fill("cat");
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    assert.ok((await response.json()).length > 0);
    await selector.selectOption("klipy");
    assert.equal(await page.evaluate(() => localStorage.getItem("fosscord.gifProvider")), "klipy");
    console.log(JSON.stringify({ admin_key_masked: true, invalid_provider_rejected: true, native_selector: true, tenor_live_search: true, klipy_selection_persisted: true }));
} finally {
    await browser.close();
}
