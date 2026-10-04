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

const harness = () => {
    let handler;
    const calls = [];
    const user = {
        id: "123",
        bio: "before",
        pronouns: "they/them",
        banner: null,
        theme_colors: [1, 2],
        accent_color: 1,
        profile_collectibles: [],
        email: "private@example.invalid",
        internal_secret: "must not leave entity",
        toPublicUser() {
            return { id: this.id, bio: this.bio, pronouns: this.pronouns, banner: this.banner, accent_color: this.accent_color, theme_colors: this.theme_colors };
        },
        toPrivateUser() {
            return { ...this.toPublicUser(), email: this.email };
        },
        async save() {
            calls.push({ type: "save", public: this.toPublicUser() });
        },
    };
    const exported = { exports: {} };
    const source = fs.readFileSync("src/api/routes/users/#user_id/profile.ts", "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, {
        exports: exported.exports,
        module: exported,
        require(name) {
            if (name === "express")
                return {
                    Router: () => ({
                        get() {},
                        patch(_path, _options, fn) {
                            handler = fn;
                        },
                    }),
                };
            if (name === "typeorm") return { In: (ids) => ids };
            if (name === "@spacebar/api/middlewares") return { route: (options) => options };
            if (name === "@spacebar/database") return { User: { findOneOrFail: async () => user } };
            if (name === "@spacebar/schemas") return { PrivateUserProjection: ["id", "bio", "pronouns", "email", "banner", "theme_colors", "accent_color"] };
            if (name === "@spacebar/api/util")
                return {
                    profileMetadata: (source) => source.toPublicUser(),
                    authenticatorTypes: async () => ["totp"],
                    resolveProfileCollectibles: async (_current, ids) => ids ?? [],
                };
            if (name === "@spacebar/util")
                return {
                    Config: { get: () => ({ limits: { user: { maxBio: 100, maxPronouns: 20 } } }) },
                    DiscordApiErrors: { MISSING_ACCESS: new Error("missing access") },
                    FieldErrors: (fields) => new Error(Object.keys(fields).join(",")),
                    handleFile: async () => "updated-banner",
                    emitEvent: async (event) => calls.push({ type: "self", event }),
                    broadcastUserUpdate: async (id) => calls.push({ type: "broadcast", id, public: user.toPublicUser() }),
                };
            if (name === "@spacebar/api/util/handlers/Application") return {};
            throw Error(name);
        },
    });
    return {
        user,
        calls,
        run: async (body, id = "@me") => {
            let result;
            await handler(
                { user_id: "123", params: { user_id: id }, body },
                {
                    json: (value) => {
                        result = value;
                    },
                },
            );
            return result;
        },
    };
};

test("changed banner persists before own update and public observer broadcast", async () => {
    const { run, calls } = harness();
    const response = await run({ banner: "data:image/png;base64,fixture" });
    assert.equal(response.banner, "updated-banner");
    assert.deepEqual(
        calls.map((call) => call.type),
        ["save", "self", "broadcast"],
    );
    assert.equal(calls[1].event.event, "USER_UPDATE");
    assert.equal(calls[1].event.user_id, "123");
    assert.equal(calls[1].event.data.email, "private@example.invalid");
    assert.equal(calls[1].event.data.internal_secret, undefined);
    assert.deepEqual(Array.from(calls[1].event.data.authenticator_types), ["totp"]);
    assert.equal(calls[2].public.banner, "updated-banner");
    assert.equal(calls[2].public.email, undefined);
});

test("no-op profile updates avoid expensive observer fanout", async () => {
    const { run, calls } = harness();
    await run({ bio: "before", theme_colors: [1, 2] });
    assert.deepEqual(
        calls.map((call) => call.type),
        ["save", "self"],
    );
});

test("pronoun and theme changes reach observers while unrelated values remain", async () => {
    const { run, calls, user } = harness();
    await run({ pronouns: "she/her", theme_colors: [100, 200] }, "123");
    assert.equal(user.bio, "before");
    assert.equal(calls.at(-1).type, "broadcast");
    assert.equal(calls.at(-1).public.pronouns, "she/her");
    assert.deepEqual(Array.from(calls.at(-1).public.theme_colors), [100, 200]);
});

test("invalid and unauthorized profile updates do not persist or broadcast", async () => {
    for (const [body, id] of [
        [{ bio: "x".repeat(101) }, "@me"],
        [{ pronouns: "x".repeat(21) }, "@me"],
        [{ banner: null }, "other-user"],
    ]) {
        const { run, calls } = harness();
        await assert.rejects(run(body, id));
        assert.deepEqual(calls, []);
    }
});
