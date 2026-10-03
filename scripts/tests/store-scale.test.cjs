const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function storeHarness(options = {}) {
    let source;
    const filename = path.resolve(__dirname, "../../src/api/util/utility/store.ts");
    const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    const types = { AVATAR_DECORATION: 0, PROFILE_EFFECT: 1, NAMEPLATE: 2, PROFILE_FRAME: 3 };
    vm.runInNewContext(
        js,
        {
            module,
            exports: module.exports,
            Buffer,
            require(name) {
                if (name === "@spacebar/database")
                    return {
                        StorePack: { find: async () => options.packs ?? [] },
                        StoreItem: { find: async () => options.items ?? [] },
                        StoreHiddenPack: { find: async () => [] },
                    };
                if (name === "@spacebar/util")
                    return {
                        CollectibleItemType: types,
                        Collectibles: {
                            setCustomSource: (fn) => {
                                source = fn;
                            },
                        },
                        Config: { get: () => ({ cdn: { endpointPublic: "http://local" } }) },
                        deleteFile: options.deleteFile ?? (async () => {}),
                    };
                if (name === "lambert-server/HTTPError") return { HTTPError: class extends Error {} };
                throw new Error(`Unexpected import: ${name}`);
            },
        },
        { filename },
    );
    return { ...module.exports, customSource: () => source() };
}
const pack = (id) => ({ id: String(id), name: `Pack ${id}`, summary: "", position: id, created_at: new Date(0) });
const item = (id, packId, position = id) => ({
    id: String(id),
    pack_id: String(packId),
    name: `Item ${id}`,
    label: "Art",
    summary: "",
    type: 0,
    position,
    created_at: new Date(0),
    data: { assets: { static: "hash" } },
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("grouped pack serialization preserves existing array API, ordering and orphan exclusion", () => {
    const h = storeHarness();
    const items = [item(1, 1, 2), item(2, 2), item(3, 1, 1), item(4, 9)];
    const before = items.slice();
    const grouped = h.groupStoreItems(items);
    for (const p of [pack(1), pack(2), pack(3)]) assert.deepEqual(plain(h.serializeStorePack(p, grouped)), plain(h.serializeStorePack(p, items)));
    assert.deepEqual(items, before);
    assert.deepEqual(
        plain(h.serializeStorePack(pack(1), grouped)).items.map((x) => x.id),
        ["3", "1"],
    );
});

test("custom catalog groups 100,000 items once instead of scanning every item for every pack", async () => {
    let packReads = 0;
    const packs = Array.from({ length: 1000 }, (_, i) => pack(i));
    const items = Array.from({ length: 100000 }, (_, i) => {
        const value = item(i, i % packs.length);
        Object.defineProperty(value, "pack_id", {
            get() {
                packReads++;
                return String(i % packs.length);
            },
        });
        return value;
    });
    const h = storeHarness({ packs, items });
    const catalog = await h.customSource();
    assert.equal(catalog.categories.length, 1000);
    assert.equal(
        catalog.categories.reduce((count, category) => count + category.products.length, 0),
        100000,
    );
    // One read during grouping and one when creating each product. Quadratic code reads 100 million times.
    assert.equal(packReads, items.length * 2);
});

test("large pack deletion shares a bounded budget, drains all slots and tolerates missing art", async () => {
    let active = 0;
    let peak = 0;
    let calls = 0;
    const seen = new Set();
    const h = storeHarness({
        deleteFile: async (filename) => {
            active++;
            peak = Math.max(peak, active);
            calls++;
            seen.add(filename);
            await new Promise((resolve) => setImmediate(resolve));
            active--;
            if (calls % 13 === 0) throw new Error("File already absent");
        },
    });
    const items = Array.from({ length: 200 }, (_, i) => ({
        ...item(i, 1),
        data: { assets: Object.fromEntries(Array.from({ length: 30 }, (_, slot) => [`slot${slot}`, "hash"])) },
    }));
    await h.deleteStorePackArt(pack(1), items);
    assert.equal(calls, 6002);
    assert.equal(seen.size, calls);
    assert.equal(active, 0);
    assert.equal(peak, 8);
    assert.ok(seen.has("/media/v1/collectibles-shop/1/banner"));
    calls = 0;
    await h.deleteAllStoreArt(items[0]);
    assert.equal(calls, 30);
});
