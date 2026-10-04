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

const playwright = createRequire(path.join(homedir(), ".cache/fosscord-tools/package.json"))("playwright-core");
const origin = (process.env.ORIGIN || `http://fosscord.localhost:${process.env.PORT || 3290}`).replace(/\/$/, "");
assert.ok(["localhost", "fosscord.localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use an isolated localhost instance for signup fixtures");
const username = `capsmoke${Date.now()}`;
const password = `${crypto.randomUUID()}A9`;
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
let fixtureUserId;
try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const outbound = new Set();
    const registerRequests = [];
    page.on("request", (request) => {
        if (request.url().startsWith("http") && new URL(request.url()).origin !== origin) outbound.add(new URL(request.url()).hostname);
        if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/auth/register")) registerRequests.push(request.postDataJSON());
    });
    await page.goto(`${origin}/register`);
    await page.locator("cap-widget[required]").waitFor();
    assert.equal(await page.locator("cap-widget").count(), 1);
    await page.locator('input[name="global_name"]').fill("Cap signup fixture");
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.waitForTimeout(250);
    assert.equal(registerRequests.length, 0, "Unsolved verification blocks account requests");
    assert.ok(await page.locator("cap-widget").evaluate((element) => element.matches(":invalid")));
    const solve = async () => {
        await page.locator("cap-widget").getByRole("button", { name: "Click to verify you're a human" }).click();
        await page.getByText("Verified. You can create your account.", { exact: true }).waitFor({ timeout: 60000 });
    };
    await solve();
    await page.locator("cap-widget").evaluate((element) => element.reset());
    await page.getByText("Complete this verification to create your account.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    assert.equal(registerRequests.length, 0, "Expired or reset verification blocks account requests");
    await solve();
    await page.screenshot({ path: process.env.CAP_SCREENSHOT || "/tmp/fosscord-cap-signup.png", fullPage: true });
    const registered = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/auth/register"));
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    const response = await registered;
    assert.equal(response.status(), 200);
    const account = await response.json();
    assert.ok(account.token);
    assert.equal(registerRequests.length, 1);
    assert.ok(registerRequests[0].captcha_key);
    const self = await fetch(`${origin}/api/v9/users/@me`, { headers: { authorization: account.token } });
    assert.equal(self.status, 200);
    fixtureUserId = (await self.json()).id;
    const replay = await fetch(`${origin}/api/v9/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...registerRequests[0], username: `${username}r` }),
    });
    assert.equal(replay.status, 400, "A solved token only creates one account");
    assert.equal(outbound.size, 0, "Signup and solving contact only this instance");
    await context.close();
    const retryContext = await browser.newContext();
    const retryPage = await retryContext.newPage();
    await retryPage.route("**/api/v9/auth/cap/widget.js", (route) => route.abort());
    await retryPage.goto(`${origin}/register`);
    await retryPage.getByText("Could not load account verification. Retry verification to continue.", { exact: true }).waitFor();
    await retryPage.unroute("**/api/v9/auth/cap/widget.js");
    await retryPage.getByRole("button", { name: "Retry verification", exact: true }).click();
    await retryPage.locator("cap-widget[required]").waitFor();
    assert.equal(await retryPage.locator("cap-widget").count(), 1);
    await retryContext.close();
    console.log(
        JSON.stringify(
            {
                status: "pass",
                fixtureUserId,
                fixtureUsername: username,
                visibleRequiredWidget: true,
                unsolvedBlocked: true,
                resetBlocked: true,
                nativeSignup: 200,
                tokenReplay: 400,
                loadRetry: true,
                externalHosts: [],
            },
            null,
            2,
        ),
    );
} finally {
    if (fixtureUserId) console.error(`Remove isolated fixture user ${fixtureUserId} (${username}) from the test database.`);
    await browser.close();
}
