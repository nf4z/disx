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
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const loadEmail = () => {
    const logs = [];
    const files = [];
    const module = { exports: {} };
    const imports = {
        "node:fs/promises": {
            readFile: async (name) => {
                files.push(name);
                return "<title>Test email</title>{actionUrl}";
            },
        },
        "node:path": path,
        "../../../database/entities": {},
        "../Config": { Config: { get: () => ({ email: {}, general: { instanceName: "Local test instance" } }) } },
        "node:crypto": {},
        jsonwebtoken: {},
        "../Token": {},
        "./clients/SendGridEmailClient": {},
        "./clients/SMTPEmailClient": {},
        "./clients/MailGunEmailClient": {},
        "./clients/MailJetEmailClient": {},
    };
    vm.runInNewContext(
        ts.transpileModule(fs.readFileSync("src/util/util/email/index.ts", "utf8"), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText,
        {
            module,
            exports: module.exports,
            __dirname: path.resolve("src/util/util/email"),
            console: { log: (value) => logs.push(value) },
            require: (name) => {
                assert.ok(name in imports, name);
                return imports[name];
            },
        },
    );
    return { ...module.exports, logs, files };
};
test("absent mail transport skips verification/reset/password-change without creating or logging secrets", async () => {
    const { Email, MailTypes, logs, files } = loadEmail();
    Email.generateLink = async () => {
        throw new Error("Do not generate a secret when no email can be delivered");
    };
    const user = { id: "fixture-user", email: "private@example.invalid", username: "Private fixture" };
    for (const type of Object.values(MailTypes)) await Email.sendMail(type, user, user.email);
    assert.equal(logs.length, 3);
    assert.equal(files.length, 0);
    for (const log of logs) {
        assert.match(log, /fixture-user/);
        assert.ok(!log.includes(user.email));
        assert.ok(!log.includes(user.username));
        assert.ok(!log.includes("http"));
        assert.ok(!log.includes("token="));
    }
});
test("configured mail transport still delivers action link in message without logging it", async () => {
    const { Email, MailTypes, logs } = loadEmail();
    const messages = [];
    Email.transporter = { sendMail: async (message) => messages.push(message) };
    Email.generateLink = async () => "https://instance.invalid/reset#token=fixture-secret";
    await Email.sendMail(MailTypes.resetPassword, { id: "fixture-user" }, "recipient@example.invalid");
    assert.equal(messages.length, 1);
    assert.ok(messages[0].html.includes("fixture-secret"));
    assert.ok(messages[0].text.includes("fixture-secret"));
    assert.equal(logs.length, 0);
});
