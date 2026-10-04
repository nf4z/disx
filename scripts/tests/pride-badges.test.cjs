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

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const load = (file, imports = {}) => {
    const module = { exports: {} };
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, {
        module,
        exports: module.exports,
        require: (name) => {
            if (!(name in imports)) throw Error(name);
            return imports[name];
        },
    });
    return module.exports;
};
const catalog = load("src/api/util/utility/prideBadges.ts");
const harness = () => {
    const handlers = {};
    const writes = [];
    const broadcasts = [];
    const user = { id: "self", pride_badges: ["rainbow"], badge_ids: ["operator"], email: "private@example.invalid", rights: "secret" };
    load("src/api/routes/users/@me/pride-badges.ts", {
        express: { Router: () => ({ get: (_path, _options, fn) => (handlers.get = fn), patch: (_path, _options, fn) => (handlers.patch = fn) }) },
        "@spacebar/api/middlewares": { route: (options) => options },
        "@spacebar/api/util/utility/prideBadges": catalog,
        "@spacebar/database": {
            User: {
                findOneOrFail: async ({ where, select }) => {
                    assert.equal(where.id, "self");
                    assert.deepEqual(Object.keys(select), ["id", "pride_badges"]);
                    return user;
                },
                createQueryBuilder: () => {
                    let data;
                    let id;
                    const query = {
                        update: () => query,
                        set: (value) => {
                            data = value;
                            return query;
                        },
                        where: (condition, parameters) => {
                            assert.equal(condition, "id = :user_id");
                            id = parameters.user_id;
                            return query;
                        },
                        andWhere: (condition, parameters) => {
                            assert.equal(condition, "pride_badges IS DISTINCT FROM :selected::text[]");
                            assert.equal(parameters.selected, data.pride_badges);
                            return query;
                        },
                        execute: async () => {
                            if (JSON.stringify(user.pride_badges) === JSON.stringify(data.pride_badges)) return { affected: 0 };
                            writes.push({ where: { id }, data });
                            Object.assign(user, data);
                            return { affected: 1 };
                        },
                    };
                    return query;
                },
            },
        },
        "@spacebar/schemas": {},
        "@spacebar/util": { FieldErrors: () => Error("invalid flags"), broadcastUserUpdate: async (id, flags) => broadcasts.push({ id, flags }) },
    });
    const invoke = async (method, body) => {
        let result;
        await handlers[method]({ user_id: "self", body }, { json: (value) => (result = value) });
        return result;
    };
    return { invoke, writes, broadcasts, user };
};

test("catalog has 33 unique locally hosted flag icons and valid badge identifiers", () => {
    assert.equal(catalog.PRIDE_BADGES.length, 33);
    for (const field of ["slug", "id", "icon"]) assert.equal(new Set(catalog.PRIDE_BADGES.map((b) => b[field])).size, 33);
    for (const badge of catalog.PRIDE_BADGES) {
        assert.match(badge.id, /^[0-9]+$/);
        assert.ok(BigInt(badge.id) <= 9223372036854775807n);
        const svg = fs.readFileSync(`assets/badge-icons/${badge.icon}.svg`, "utf8");
        assert.match(svg, /viewBox="0 0 150 100"/);
        assert.doesNotMatch(svg, /(?:href|script|foreignObject|https?:\/\/[^w])/i);
    }
});

test("profile projection preserves selection order, removes duplicates and ignores unknown stored flags", () => {
    const badges = catalog.prideBadges(["transgender", "rainbow", "transgender", "operator"]);
    assert.deepEqual(
        JSON.parse(JSON.stringify(badges)),
        JSON.parse(
            JSON.stringify(
                catalog.PRIDE_BADGES.filter((b) => ["transgender", "rainbow"].includes(b.slug))
                    .reverse()
                    .map(({ id, description, icon }) => ({ id, description, icon })),
            ),
        ),
    );
    assert.equal(catalog.prideBadges(null).length, 0);
});

test("own selection persists only pride flags and emits only explicit public selections", async () => {
    const h = harness();
    const result = await h.invoke("patch", { flags: ["transgender", "rainbow", "transgender"], badge_ids: ["admin"], user_id: "other" });
    assert.deepEqual(JSON.parse(JSON.stringify(h.writes)), [{ where: { id: "self" }, data: { pride_badges: ["transgender", "rainbow"] } }]);
    assert.deepEqual(Array.from(h.user.badge_ids), ["operator"]);
    assert.deepEqual(JSON.parse(JSON.stringify(h.broadcasts)), [{ id: "self", flags: ["transgender", "rainbow"] }]);
    assert.doesNotMatch(JSON.stringify(result), /private@example|secret|operator/);
});

test("clearing selections preserves admin badges and GET returns the persisted empty selection", async () => {
    const h = harness();
    await h.invoke("patch", { flags: [] });
    const result = await h.invoke("get");
    assert.equal(result.flags.length, 0);
    assert.deepEqual(Array.from(h.user.badge_ids), ["operator"]);
});

test("unknown flags, admin IDs, invalid shapes and oversized arrays never write or broadcast", async () => {
    for (const flags of [["operator"], [catalog.PRIDE_BADGES[0].id], [null], [1], "rainbow", null, Array(34).fill("rainbow")]) {
        const h = harness();
        await assert.rejects(h.invoke("patch", { flags }), /invalid flags/);
        assert.equal(h.writes.length, 0);
        assert.equal(h.broadcasts.length, 0);
    }
});

test("observer events use the public user projection plus explicit pride slugs", async () => {
    const events = [];
    const presence = load("src/util/util/Presence.ts", {
        "@spacebar/database": {
            User: { getPublicUser: async () => ({ id: "self", username: "public" }) },
            Member: { find: async () => [{ guild_id: "guild", roles: [{ id: "guild" }, { id: "role" }], toPublicMember: () => ({ id: "self", nick: "public nick" }) }] },
            Relationship: { find: async () => [] },
            Recipient: { find: async () => [] },
            Session: { find: async () => [] },
        },
        "@spacebar/util": { emitEvent: async (event) => events.push(event) },
        "@spacebar/schemas": { RelationshipType: { FRIEND: 1 } },
        typeorm: { In: (value) => value, Not: (value) => value },
    });
    await presence.broadcastUserUpdate("self", ["transgender"]);
    assert.equal(events.length, 3);
    for (const event of events) {
        assert.deepEqual(JSON.parse(JSON.stringify(event.data.user)), { id: "self", username: "public", pride_badges: ["transgender"] });
        assert.doesNotMatch(JSON.stringify(event), /email|token|rights|password|account_preferences/);
    }
});

test("unchanged selections perform no write and no observer fanout", async () => {
    const h = harness();
    const result = await h.invoke("patch", { flags: ["rainbow", "rainbow"] });
    assert.deepEqual(Array.from(result.flags), ["rainbow"]);
    assert.equal(h.writes.length, 0);
    assert.equal(h.broadcasts.length, 0);
});

test("all 33 catalog flags can be selected together without changing assigned badges", async () => {
    const h = harness();
    const flags = Array.from(catalog.PRIDE_BADGES, (badge) => badge.slug);
    const result = await h.invoke("patch", { flags });
    assert.deepEqual(Array.from(result.flags), flags);
    assert.equal(h.user.pride_badges.length, 33);
    assert.deepEqual(Array.from(h.user.badge_ids), ["operator"]);
});
