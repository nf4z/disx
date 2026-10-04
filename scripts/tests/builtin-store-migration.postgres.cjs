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

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { Client } = require("pg");
const { userInfo } = require("node:os");
const { randomBytes } = require("node:crypto");
const database = "builtin_store_migration_" + randomBytes(6).toString("hex");
const options = { host: "localhost", port: 5432, user: userInfo().username };
const moduleUnderTest = { exports: {} };
const filename = "src/database/migration/postgres/1791662738491-BuiltinStorePackCustomization.ts";
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: moduleUnderTest,
    exports: moduleUnderTest.exports,
    require,
});
(async () => {
    const control = new Client({ ...options, database: "postgres" });
    await control.connect();
    await control.query("CREATE DATABASE " + database);
    const client = new Client({ ...options, database });
    await client.connect();
    try {
        await client.query("CREATE TABLE store_hidden_packs(sku_id bigint PRIMARY KEY)");
        await client.query("INSERT INTO store_hidden_packs VALUES(10)");
        const migration = new moduleUnderTest.exports.BuiltinStorePackCustomization1791662738491();
        const runner = { query: (sql) => client.query(sql) };
        await migration.up(runner);
        await migration.up(runner);
        assert.deepEqual((await client.query("SELECT * FROM store_hidden_packs")).rows, [{ sku_id: "10", hidden: true, customization: {} }]);
        await client.query('INSERT INTO store_hidden_packs VALUES(20,false,\'{"name":"Local name"}\')');
        await migration.up(runner);
        assert.equal((await client.query("SELECT hidden FROM store_hidden_packs WHERE sku_id=20")).rows[0].hidden, false);
        await migration.down(runner);
        await migration.down(runner);
        assert.deepEqual((await client.query("SELECT * FROM store_hidden_packs")).rows, [{ sku_id: "10" }]);
        console.log("PASS builtin migration: legacy hidden preserved, visible customization preserved, repeatable up/down and safe rollback");
    } finally {
        await client.end();
        await control.query("DROP DATABASE " + database);
        await control.end();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
