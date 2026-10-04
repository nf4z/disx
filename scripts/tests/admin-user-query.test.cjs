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

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function harness() {
    let handler;
    const calls = [],
        query = {};
    for (const name of ["select", "orderBy", "addOrderBy", "take", "skip", "where", "orWhere", "andWhere"])
        query[name] = (...args) => {
            if (name === "where" && typeof args[0] === "object") args[0].run(query);
            else calls.push([name, ...args]);
            return query;
        };
    query.getManyAndCount = async () => {
        calls.push(["execute"]);
        return [[], 0];
    };
    const module = { exports: {} };
    const js = ts.transpileModule(fs.readFileSync("src/api/routes/admin/users/index.ts", "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(js, {
        module,
        exports: module.exports,
        require(name) {
            if (name === "express")
                return {
                    Router: () => ({
                        get: (_path, options, fn) => {
                            assert.equal(options.right, "MANAGE_USERS");
                            handler = fn;
                        },
                    }),
                };
            if (name === "typeorm")
                return {
                    Brackets: class {
                        constructor(run) {
                            this.run = run;
                        }
                    },
                };
            if (name === "@spacebar/api/middlewares") return { route: (options) => options };
            if (name === "@spacebar/database") return { User: { createQueryBuilder: () => query } };
            if (name === "@spacebar/util") return { Rights: class {} };
            if (name === "@spacebar/schemas") return { UserFlags: { FLAGS: { VERIFIED_BOT: 1, AI_ACCOUNT: 2, OFFICIAL_TAG: 4, SYSTEM_TAG: 8 } } };
            if (name === "lambert-server/HTTPError")
                return {
                    HTTPError: class extends Error {
                        constructor(message, status) {
                            super(message);
                            this.status = status;
                        }
                    },
                };
            throw Error(name);
        },
    });
    return { calls, run: (parameters) => handler({ query: parameters }, { json: () => {} }) };
}
test("admin pagination rejects malformed inputs before executing a query", async () => {
    for (const parameters of [
        { limit: ["1", "2"] },
        { limit: "Infinity" },
        { limit: "1.5" },
        { offset: "-1" },
        { offset: "NaN" },
        { offset: "9007199254740992" },
        { q: ["a", "b"] },
        { q: "a".repeat(257) },
        { filter: "unknown" },
        { filter: ["all", "bots"] },
        { q: "99999999999999999999" },
    ]) {
        const h = harness();
        await assert.rejects(h.run(parameters), (error) => error.status === 400);
        assert.ok(!h.calls.some(([name]) => name === "execute"));
    }
});
test("admin pagination clamps limits, keeps filters and orders timestamp ties", async () => {
    const h = harness();
    await h.run({ limit: "200", offset: "25", filter: "bots" });
    assert.deepEqual(
        h.calls.find(([name]) => name === "take"),
        ["take", 100],
    );
    assert.deepEqual(
        h.calls.find(([name]) => name === "skip"),
        ["skip", 25],
    );
    assert.deepEqual(
        h.calls.find(([name]) => name === "addOrderBy"),
        ["addOrderBy", "user.id", "DESC"],
    );
    assert.deepEqual(
        h.calls.find(([name]) => name === "andWhere"),
        ["andWhere", "user.bot = true"],
    );
});
test("admin substring searches are literal and exact ids remain exact", async () => {
    const h = harness();
    await h.run({ q: " A_%\\B " });
    const search = h.calls.filter(([name]) => name === "where" || name === "orWhere");
    assert.equal(search.length, 3);
    for (const call of search) assert.equal(call[2].q, "%A\\_\\%\\\\B%");
    const id = harness();
    await id.run({ q: "123456789012345678" });
    const clause = id.calls.find(([name]) => name === "where");
    assert.equal(clause[1], "user.id = :id");
    assert.equal(clause[2].id, "123456789012345678");
    assert.ok(id.calls.find(([name]) => name === "select")[1].includes("user.email"));
    assert.ok(!id.calls.find(([name]) => name === "select")[1].includes("user.data"));
});
