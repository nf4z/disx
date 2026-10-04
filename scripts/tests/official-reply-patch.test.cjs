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
const ts = require("typescript");
const vm = require("node:vm");

test("native official reply patch preserves other system and guild restrictions", () => {
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync("client/plugins/fosscordOfficialMessages/index.ts", "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, {
        module,
        exports: module.exports,
        require: (name) => (name === "@utils/types" ? { default: (value) => value, __esModule: true } : { FosscordAuthor: {} }),
    });
    const patch = module.exports.default.patches[0].replacement;
    const match = new RegExp(patch.match.source.replaceAll("\\i", "[A-Za-z_$][\\w$]*"), patch.match.flags);
    const native = fs.readFileSync("assets/cache/web.24a0dd4254453b09.js", "utf8");
    const original = native.match(match)?.[0];
    assert.ok(original, "patch must match the cached actual native channel class");
    const changed = original.replace(match, patch.replace);
    const Channel = new Function("f", `return class { ${changed} }`)({ rbe: { DM: 1 } });
    const channel = new Channel();
    channel.type = 1;
    for (const [recipient, expected] of [
        [{ system: true, username: "official", discriminator: "0" }, false],
        [{ system: true, username: "announcements", discriminator: "0" }, true],
        [{ system: true, username: "official", discriminator: "1234" }, true],
        [{ system: false, username: "official", discriminator: "0" }, false],
        [null, false],
    ]) {
        channel.rawRecipients = [recipient];
        assert.equal(channel.isSystemDM(), expected);
    }
    channel.type = 0;
    channel.rawRecipients = [{ system: true, username: "announcements", discriminator: "0" }];
    assert.equal(channel.isSystemDM(), false);
});
