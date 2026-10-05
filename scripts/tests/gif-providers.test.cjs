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

process.env.DATABASE ??= "postgres://localhost/larpcord_gif_unit_unused";
require("../register-paths.cjs");
const assert = require("node:assert/strict");
const test = require("node:test");
const { Config } = require("../../dist/util");
const Klipy = require("../../dist/integrations/gifs/providers/KlipyGifProvider").default;
const Tenor = require("../../dist/integrations/gifs/providers/TenorGifProvider").default;
const { GifProviderManager } = require("../../dist/integrations/gifs");
const originalConfig = Config.get;
const originalFetch = global.fetch;
const config = {
    integrations: { gifs: { enabled: true, defaultProvider: "klipy", klipy: { enabled: true, apiKey: "test-key" }, tenor: { enabled: true, apiKey: "test-key" } } },
    externalRequests: { thirdParty: false },
};
const media = { url: "https://media.example/gif", width: 320, height: 180, dims: [320, 180] };
const item = {
    id: 42,
    slug: "cat",
    title: "Cat",
    file: { hd: { gif: media, mp4: { ...media, url: "https://media.example/mp4" } }, sm: { gif: media, webp: { ...media, url: "https://media.example/webp" } } },
};
test.before(() => {
    Config.get = () => config;
});
test.after(() => {
    Config.get = originalConfig;
    global.fetch = originalFetch;
});
test("klipy converts formats and clamps limits without changing caller query", async () => {
    let url;
    global.fetch = async (input) => {
        url = new URL(input);
        return Response.json({ result: true, data: { data: [item] } });
    };
    const provider = new Klipy();
    await provider.init();
    const result = await provider.search({ q: "cat", limit: -2, media_format: "tinywebp", locale: "en" });
    assert.equal(url.searchParams.get("per_page"), "1");
    assert.equal(result[0].src, "https://media.example/webp");
    assert.equal(result[0].gif_src, media.url);
});
test("klipy trending cache isolates locale and requested format", async () => {
    let requests = 0;
    global.fetch = async () => {
        requests++;
        return Response.json({ result: true, data: { data: [item] } });
    };
    const provider = new Klipy();
    await provider.init();
    await provider.getTrendingGifs({ locale: "en", media_format: "gif" });
    await provider.getTrendingGifs({ locale: "en", media_format: "gif" });
    const webp = await provider.getTrendingGifs({ locale: "en", media_format: "tinywebp" });
    await provider.getTrendingGifs({ locale: "fr", media_format: "gif" });
    assert.equal(requests, 3);
    assert.equal(webp[0].src, "https://media.example/webp");
});
test("klipy error never contains key or upstream response", async () => {
    global.fetch = async () => new Response("secret raw upstream failure", { status: 401 });
    const provider = new Klipy();
    await provider.init();
    await assert.rejects(provider.search({ q: "cat", media_format: "gif", locale: "en" }), (error) => error.message === "Klipy request failed (401)");
});
test("missing key file disables klipy instead of failing startup", async () => {
    const previous = config.integrations.gifs.klipy;
    config.integrations.gifs.klipy = { enabled: true, apiKeyPath: "/does-not-exist/larpcord-key" };
    try {
        const provider = new Klipy();
        await provider.init();
        assert.equal(provider.available, false);
    } finally {
        config.integrations.gifs.klipy = previous;
    }
});
test("tenor genuinely uses upstream v1 and maps Vencord media", async () => {
    let url;
    global.fetch = async (input) => {
        url = new URL(input);
        return Response.json({
            results: [{ id: "1", title: "Cat", itemurl: "https://tenor.com/view/cat", media: [{ gif: media, tinywebm: { ...media, url: "https://media.example/webm" } }] }],
        });
    };
    const provider = new Tenor();
    await provider.init();
    const result = await provider.search({ q: "cat", limit: 2, media_format: "webm", locale: "en" });
    assert.equal(url.host, "api.tenor.com");
    assert.equal(url.pathname, "/v1/search");
    assert.equal(result[0].src, "https://media.example/webm");
});
test("provider selection never silently substitutes another provider", async () => {
    await GifProviderManager.init();
    assert.equal(GifProviderManager.findProvider().id, "klipy");
    assert.equal(GifProviderManager.findProvider("tenor").id, "tenor");
    assert.equal(GifProviderManager.findProvider("unknown"), undefined);
    assert.equal(config.externalRequests.thirdParty, false);
});
