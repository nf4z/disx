const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const ts = require("typescript");

// Execute the actual TypeScript modules with isolated config, assets, and network.
// No database, environment credentials, timers, or external services are required.
async function load(relative, assets, overrides = {}) {
    const source = await fs.readFile(path.join(__dirname, "../..", relative), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const exported = { exports: {} };
    const context = vm.createContext({
        module: exported,
        exports: exported.exports,
        Buffer,
        AbortSignal,
        process: { env: overrides.env ?? {}, pid: process.pid },
        console: { error() {}, log() {} },
        fetch:
            overrides.fetch ??
            (() => {
                throw new Error("Unexpected network request");
            }),
        setInterval: () => ({
            unref() {
                return this;
            },
        }),
        require(id) {
            if (id.endsWith("/Constants") || id === "./Constants") return { ASSETS_FOLDER: assets };
            if (id.endsWith("/Config") || id === "./Config")
                return { Config: { get: () => ({ cdn: { endpointPublic: "http://local-cdn", endpointPrivate: "http://local-cdn" } }) } };
            if (id === "./Branding") return { instanceName: () => "Test instance" };
            if (id === "node:fs/promises" && overrides.fs) return overrides.fs;
            if (id === "jimp" && overrides.jimp) return overrides.jimp;
            return require(id);
        },
    });
    vm.runInContext(js, context, { filename: relative });
    return exported.exports;
}

async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-local-catalog-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    return directory;
}
const category = {
    sku_id: "10",
    name: "Discord pack",
    products: [
        {
            sku_id: "11",
            name: "Decoration",
            type: 0,
            items: [{ sku_id: "12", type: 0, asset: "image" }],
            prices: { 0: { country_prices: { country_code: "US", prices: [{ amount: 500, currency: "USD", exponent: 2 }] } } },
        },
    ],
};

test("missing catalog is cached and custom packs remain available without network", async (t) => {
    const directory = await fixture(t);
    let reads = 0;
    const { Collectibles } = await load("src/util/util/Collectibles.ts", directory, {
        fs: {
            ...fs,
            stat: (...args) => {
                reads++;
                return fs.stat(...args);
            },
        },
    });
    Collectibles.setCustomSource(async () => ({ categories: [category], hidden: [] }));
    const first = await Collectibles.get();
    assert.equal(first.categories.length, 1);
    assert.equal(await Collectibles.get(), first);
    assert.equal(reads, 2);
    assert.equal((await Collectibles.refresh()).ok, true);
    assert.equal((await Collectibles.product("11")).name, "Decoration");
    assert.equal((await Collectibles.status()).catalog.external_refresh_enabled, false);
});

test("stale local catalog stays free and hidden packs preserve owned-item lookup", async (t) => {
    const directory = await fixture(t);
    await fs.writeFile(path.join(directory, "collectibles.json"), JSON.stringify([category]));
    await fs.utimes(path.join(directory, "collectibles.json"), new Date(0), new Date(0));
    const { Collectibles } = await load("src/util/util/Collectibles.ts", directory);
    Collectibles.setCustomSource(async () => ({ categories: [], hidden: ["10"] }));
    assert.equal((await Collectibles.categories()).length, 0);
    const product = await Collectibles.product("11");
    assert.equal(product.prices["0"].country_prices.prices[0].amount, 0);
    assert.equal((await Collectibles.builtinCategories())[0].name, "Test instance pack");
    assert.equal((await Collectibles.item("12", 0)).asset, "image");
});

test("a URL alone does not enable external refresh", async (t) => {
    const directory = await fixture(t);
    const { Collectibles } = await load("src/util/util/Collectibles.ts", directory, { env: { COLLECTIBLES_CATALOG_URL: "https://operator.example/catalog.json" } });
    assert.equal((await Collectibles.refresh()).ok, true);
    assert.equal((await Collectibles.status()).catalog.external_refresh_enabled, false);
});

test("opted-in refreshes are deduplicated and have a bounded abort signal", async (t) => {
    const directory = await fixture(t);
    let requests = 0;
    const { Collectibles } = await load("src/util/util/Collectibles.ts", directory, {
        env: { COLLECTIBLES_EXTERNAL_REFRESH: "true", COLLECTIBLES_CATALOG_URL: "https://operator.example/catalog.json" },
        fetch: async (_, options) => {
            requests++;
            assert.ok(options.signal instanceof AbortSignal);
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { ok: true, text: async () => JSON.stringify([category]) };
        },
    });
    const results = await Promise.all(Array.from({ length: 20 }, () => Collectibles.refresh()));
    assert.equal(requests, 1);
    assert.equal(results[0].ok, true);
    assert.equal((await Collectibles.product("11")).prices["0"].country_prices.prices[0].amount, 0);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, "collectibles.json"), "utf8")), [category]);
});

test("invalid external catalog cannot overwrite a valid local snapshot", async (t) => {
    const directory = await fixture(t);
    const snapshot = JSON.stringify([category]);
    await fs.writeFile(path.join(directory, "collectibles.json"), snapshot);
    const { Collectibles } = await load("src/util/util/Collectibles.ts", directory, {
        env: { COLLECTIBLES_EXTERNAL_REFRESH: "true", COLLECTIBLES_CATALOG_URL: "https://operator.example/catalog.json" },
        fetch: async () => ({ ok: true, text: async () => '[{"sku_id":"not-a-snowflake"}]' }),
    });
    assert.equal((await Collectibles.refresh()).ok, false);
    assert.equal(await fs.readFile(path.join(directory, "collectibles.json"), "utf8"), snapshot);
});

test("unicode bursts dedupe local image reads and cache deterministic fallback without network", async (t) => {
    const directory = await fixture(t);
    let reads = 0;
    const { getBurstColors } = await load("src/api/util/utility/BurstColors.ts", directory, {
        fs: {
            ...fs,
            readFile: async (...args) => {
                reads++;
                return fs.readFile(...args);
            },
        },
    });
    const colors = await Promise.all(Array.from({ length: 30 }, () => getBurstColors({ name: "❤️" })));
    assert.equal(reads, 1);
    assert.equal(colors[0].length, 2);
    assert.ok(colors[0].every((color) => /^#[a-f0-9]{6}$/i.test(color)));
    assert.deepEqual(await getBurstColors({ name: "❤" }), colors[0]);
    colors[0][0] = "changed";
    assert.notEqual((await getBurstColors({ name: "❤" }))[0], "changed");
    assert.equal(reads, 1);
});

test("local Twemoji palette is used when present", async (t) => {
    const directory = await fixture(t);
    await fs.mkdir(path.join(directory, "twemoji", "72x72"), { recursive: true });
    await fs.writeFile(path.join(directory, "twemoji", "72x72", "2764.png"), "local fixture");
    const { getBurstColors } = await load("src/api/util/utility/BurstColors.ts", directory, {
        jimp: { Jimp: { read: async () => ({ bitmap: { data: Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]) } }) } },
    });
    assert.deepEqual(Array.from(await getBurstColors({ name: "❤" })), ["#ff0000", "#00ff00"]);
});

test("unicode burst cache evicts old keys after 1024 entries", async (t) => {
    const directory = await fixture(t);
    let reads = 0;
    const { getBurstColors } = await load("src/api/util/utility/BurstColors.ts", directory, {
        fs: {
            ...fs,
            readFile: async () => {
                reads++;
                throw new Error("No local image");
            },
        },
    });
    for (let i = 0; i < 1025; i++) await getBurstColors({ name: String.fromCodePoint(0x1f300 + i) });
    await getBurstColors({ name: String.fromCodePoint(0x1f300) });
    assert.equal(reads, 1026);
});

test("a pending refresh cannot republish custom packs invalidated by reload", async (t) => {
    const directory = await fixture(t);
    const { Collectibles } = await load("src/util/util/Collectibles.ts", directory);
    let unblock;
    let started;
    const waiting = new Promise((resolve) => {
        started = resolve;
    });
    const gate = new Promise((resolve) => {
        unblock = resolve;
    });
    let calls = 0;
    Collectibles.setCustomSource(async () => {
        calls++;
        if (calls === 1) {
            started();
            await gate;
            return { categories: [category], hidden: [] };
        }
        return { categories: [], hidden: [] };
    });
    const pending = Collectibles.refresh();
    await waiting;
    Collectibles.reload();
    const current = await Collectibles.get();
    assert.equal(current.categories.length, 0);
    unblock();
    assert.equal((await pending).ok, true);
    assert.equal(await Collectibles.get(), current);
    assert.equal(calls, 2);
});

test("replacing the custom source during refresh keeps the new source published", async (t) => {
    const directory = await fixture(t);
    const { Collectibles } = await load("src/util/util/Collectibles.ts", directory);
    let unblock;
    let started;
    const waiting = new Promise((resolve) => {
        started = resolve;
    });
    const gate = new Promise((resolve) => {
        unblock = resolve;
    });
    Collectibles.setCustomSource(async () => {
        started();
        await gate;
        return { categories: [category], hidden: [] };
    });
    const pending = Collectibles.refresh();
    await waiting;
    Collectibles.setCustomSource(async () => ({ categories: [], hidden: [] }));
    const current = await Collectibles.get();
    unblock();
    await pending;
    assert.equal(await Collectibles.get(), current);
    assert.equal((await Collectibles.categories()).length, 0);
});
