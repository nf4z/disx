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

// Lists every experiment defined in the downloaded web client and the variation (apex) or treatment (legacy)
// that turns its feature on, so the server can roll all of them out. Writes assets/cache/experiments.json.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CACHE = path.resolve(process.env.CLIENT_CACHE_PATH || path.join(__dirname, "..", "assets", "cache"));
const OUTPUT = path.join(CACHE, "experiments.json");

// the object literal that starts at `start` (an opening brace), respecting strings and nesting
const sliceObject = (source, start) => {
    const closers = { "(": ")", "[": "]", "{": "}" };
    const stack = [];
    let quote = null;
    for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") quote = ch;
        else if (closers[ch]) stack.push(closers[ch]);
        else if (ch === ")" || ch === "]" || ch === "}") {
            stack.pop();
            if (!stack.length) return source.slice(start, i + 1);
        }
    }
    return null;
};

// minified identifiers inside a definition (constants from other modules) evaluate to undefined
const scope = new Proxy({}, { has: () => true, get: (_, key) => (key === Symbol.unscopables ? undefined : undefined) });
const evaluate = (literal) => {
    try {
        return vm.runInNewContext(`with (scope) { (${literal}) }`, { scope }, { timeout: 50 });
    } catch {
        return null;
    }
};

// keys whose `true` means less of a feature, so turning them on is not a rollout
const NEGATIVE_KEY = /^(disable|disabled|hide|hidden|block|kill|suppress|skip|remove|prevent|exclude|holdout|no[A-Z_])/i;

// how much a variation turns on compared with the default config
const score = (config, defaults) => {
    if (!config || typeof config !== "object") return 0;
    let total = 0;
    for (const [key, value] of Object.entries(config)) {
        const before = defaults?.[key];
        if (value === before) continue;
        const negative = NEGATIVE_KEY.test(key);
        if (typeof value === "boolean") total += value !== negative ? 1 : -1;
        else if (typeof value === "number" && typeof before === "number") total += value > before ? 0.5 : -0.25;
        else if (value != null) total += 0.5;
    }
    return total;
};

const best = (options, defaults) => {
    let chosen = null;
    for (const { id, config } of options) {
        const value = score(config, defaults);
        // ties go to the later variation, which is usually the fuller rollout
        if (value > 0 && (!chosen || value >= chosen.score)) chosen = { id, score: value };
    }
    return chosen;
};

const apex = new Map();
const legacy = new Map();
const skipped = new Set();

for (const file of fs.readdirSync(CACHE).filter((name) => name.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(CACHE, file), "utf8");

    for (const match of source.matchAll(/\(\{name:"([^"]+)",kind:"(user|guild|installation)",/g)) {
        const [, name, kind] = match;
        if (apex.has(name)) continue;
        const definition = evaluate(sliceObject(source, match.index + 1));
        if (!definition?.variations) continue;
        const options = Object.entries(definition.variations).map(([id, config]) => ({ id: Number(id), config }));
        const chosen = best(options, definition.defaultConfig);
        if (chosen) apex.set(name, { name, kind, variant: chosen.id });
        else skipped.add(name);
    }

    for (const match of source.matchAll(/\(\{kind:"(user|guild)",id:"([^"]+)",/g)) {
        const [, kind, id] = match;
        if (legacy.has(id)) continue;
        const definition = evaluate(sliceObject(source, match.index + 1));
        if (!Array.isArray(definition?.treatments)) continue;
        const chosen = best(definition.treatments, definition.defaultConfig);
        if (chosen) legacy.set(id, { id, kind, bucket: chosen.id });
        else skipped.add(id);
    }
}

const byName = (a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id);
const output = { apex: [...apex.values()].sort(byName), legacy: [...legacy.values()].sort(byName), skipped: [...skipped].sort() };
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 4));
console.log(`[experiments] ${output.apex.length} apex and ${output.legacy.length} legacy experiments can be rolled out, ${output.skipped.length} have no enabling variation; wrote ${path.relative(process.cwd(), OUTPUT)}`);
