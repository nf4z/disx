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
const origin = (process.env.ORIGIN || `http://larpcord.localhost:${process.env.PORT || 3290}`).replace(/\/$/, "");
assert.ok(["localhost", "larpcord.localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use an isolated localhost instance for signup fixtures");
const username = `capsmoke${Date.now()}`;
const password = `${crypto.randomUUID()}A9`;
const browserName = process.env.BROWSER || "chromium";
assert.ok(["chromium", "webkit"].includes(browserName), "BROWSER must be chromium or webkit");
const browser = await playwright[browserName].launch(
    browserName === "chromium" ? { executablePath: process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true } : { headless: true },
);
const contextOptions = browserName === "webkit" ? playwright.devices["iPhone 13"] : {};
const pageErrors = [];
const trackErrors = (page) =>
    page.on("pageerror", (error) => {
        if (!error.message.includes("Sentry successfully disabled")) pageErrors.push(error.message);
    });
let fixtureUserId;
const registerRoute = (url) => url.pathname.endsWith("/auth/register");
try {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    trackErrors(page);
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
    await page.locator('input[name="username"]').fill("x".repeat(100));
    const rejectedField = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/auth/register"));
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    const fieldResponse = await rejectedField;
    assert.equal(fieldResponse.status(), 400);
    assert.ok((await fieldResponse.json()).errors?.username);
    assert.equal(await page.getByText("Verified. You can create your account.", { exact: true }).isVisible(), true, "Correctable field errors retain verification");
    await page.locator('input[name="username"]').fill(username);
    if (browserName === "chromium") {
        let rejectProof = true;
        await page.route(registerRoute, async (route) => {
            if (!rejectProof) return route.continue();
            rejectProof = false;
            return route.fulfill({
                status: 400,
                contentType: "application/json",
                body: JSON.stringify({ captcha_service: "cap", captcha_sitekey: "larpcord", captcha_key: ["invalid-input-response"] }),
            });
        });
        await page.getByRole("button", { name: "Create Account", exact: true }).click();
        await page.getByText("Verification expired or was already used. Verify again, then create your account.", { exact: true }).waitFor();
        assert.equal(await page.getByText(/Wait!.*human/).count(), 0, "Expired proof does not open Discord CAPTCHA modal");
        await page.unroute(registerRoute);
        await solve();
    }
    await page.screenshot({ path: process.env.CAP_SCREENSHOT || "/tmp/larpcord-cap-signup.png", fullPage: true });
    const registered = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/auth/register"));
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    const response = await registered;
    assert.equal(response.status(), 200);
    const account = await response.json();
    assert.ok(account.token);
    assert.equal(registerRequests.length, browserName === "webkit" ? 2 : 3);
    assert.ok(registerRequests.at(-1).captcha_key);
    const self = await fetch(`${origin}/api/v9/users/@me`, { headers: { authorization: account.token } });
    assert.equal(self.status, 200);
    fixtureUserId = (await self.json()).id;
    const replay = await fetch(`${origin}/api/v9/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...registerRequests.at(-1), username: `${username}r` }),
    });
    assert.equal(replay.status, 400, "A solved token only creates one account");
    assert.equal(outbound.size, 0, "Signup and solving contact only this instance");
    await context.close();
    if (browserName === "chromium") {
        const retryContext = await browser.newContext(contextOptions);
        const retryPage = await retryContext.newPage();
        trackErrors(retryPage);
        await retryPage.route("**/api/v9/auth/cap/widget.js", (route) => route.abort());
        await retryPage.goto(`${origin}/register`);
        await retryPage.getByText("Could not load account verification. Retry verification to continue.", { exact: true }).waitFor();
        await retryPage.unroute("**/api/v9/auth/cap/widget.js");
        await retryPage.getByRole("button", { name: "Retry verification", exact: true }).click();
        await retryPage.locator("cap-widget[required]").waitFor();
        assert.equal(await retryPage.locator("cap-widget").count(), 1);
        await retryContext.close();
    }
    const mobileContext = await browser.newContext({ ...playwright.devices[browserName === "webkit" ? "iPhone 13" : "Pixel 5"] });
    const mobilePage = await mobileContext.newPage();
    trackErrors(mobilePage);
    await mobilePage.goto(`${origin}/register`);
    await mobilePage.locator("cap-widget[required]").waitFor();
    assert.equal(await mobilePage.locator("cap-widget").getAttribute("data-cap-worker-count"), "2");
    await mobilePage.locator("cap-widget").getByRole("button", { name: "Click to verify you're a human" }).click();
    await mobilePage.getByText("Verified. You can create your account.", { exact: true }).waitFor({ timeout: 60000 });
    await mobilePage.screenshot({ path: "/tmp/larpcord-cap-mobile-bounded-workers.png", fullPage: true });
    await mobileContext.close();
    assert.deepEqual(pageErrors, [], "Signup has no unexpected browser runtime errors");
    console.log(
        JSON.stringify(
            {
                status: "pass",
                browser: browserName,
                device: browserName === "webkit" ? "iPhone 13" : "desktop and Pixel 5",
                fixtureUserId,
                fixtureUsername: username,
                visibleRequiredWidget: true,
                unsolvedBlocked: true,
                resetBlocked: true,
                nativeSignup: 200,
                fieldErrorRetainsProof: true,
                invalidProofInlineRetry: browserName === "chromium",
                mobileTouchWorkers: 2,
                mobileProofSolved: true,
                tokenReplay: 400,
                loadRetry: browserName === "chromium",
                externalHosts: [],
            },
            null,
            2,
        ),
    );
} finally {
    console.error(`Isolated signup fixture: ${username}${fixtureUserId ? ` (user ${fixtureUserId})` : ""}. Remove this account if it was created.`);
    await browser.close();
}
