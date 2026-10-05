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

import fs from "node:fs";
import path from "node:path";
import murmur from "murmurhash-js/murmurhash3_gc";
import { Config } from "./Config";
import { ASSETS_FOLDER } from "./Constants";

export const SCHEDULED_MESSAGE_LIMIT = 25;
export const SAVED_MESSAGE_LIMIT = 500;
export const MESSAGE_REMINDER_LIMIT = 100;

const defaults: Record<string, { variant: number; config?: object }> = {
    "2026-08-scheduled-messages": { variant: 1, config: { limit: SCHEDULED_MESSAGE_LIMIT } },
    "2026-03-message-bookmarks": { variant: 1 },
    "2026-07-message-bookmarks-v2": { variant: 1, config: { b: SAVED_MESSAGE_LIMIT, r: MESSAGE_REMINDER_LIMIT } },
    "2026-08-mark-channel-unread": { variant: 1 },
    "2026-03-soundmoji-rendering": { variant: 1 },
    "2026-03-soundmoji-sending": { variant: 2 },
    "2026-09-soundboard-favorites": { variant: 2 },
    "2026-03-friend-request-message": { variant: 1 },
    "2026-09-connected-thread-sidebar": { variant: 1 },
};

export type ApexAssignment = [number, number, number, number, number, string | undefined];
type Kind = "user" | "guild" | "installation";
type Catalog = { apex: { name: string; kind: Kind; variant: number }[]; legacy: { id: string; kind: "user" | "guild"; bucket: number }[] };

// apex unit types, as the client numbers them
const UNIT = { user: 1, installation: 2, guild: 3 } as const;
const CATALOG_FILE = path.join(ASSETS_FOLDER, "cache", "experiments.json");
let catalog: { mtime: number; value: Catalog } | null = null;

// every experiment the downloaded client defines, re-read when scripts/experiments.js regenerates it
function getCatalog(): Catalog {
    const empty: Catalog = { apex: [], legacy: [] };
    if (!Config.get().client.rolloutAllExperiments) return empty;
    try {
        const mtime = fs.statSync(CATALOG_FILE).mtimeMs;
        if (catalog?.mtime !== mtime) catalog = { mtime, value: JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8")) };
        return catalog.value;
    } catch {
        return empty;
    }
}

function isExcluded(name: string) {
    return (Config.get().client.experimentExclusions ?? []).some((pattern) => (pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern));
}

function assignmentsFor(kind: Kind): ApexAssignment[] {
    const overrides = Config.get().client.experiments ?? {};
    const variants = new Map<string, number>();
    for (const { name, kind: experimentKind, variant } of getCatalog().apex) if (experimentKind === kind && !isExcluded(name)) variants.set(name, variant);
    if (kind === "user") for (const [name, { variant }] of Object.entries(defaults)) variants.set(name, variant);
    // config overrides apply to whichever unit the experiment is for; unknown names are treated as user experiments
    for (const [name, variant] of Object.entries(overrides)) {
        const known = getCatalog().apex.find((experiment) => experiment.name === name)?.kind ?? "user";
        if (known === kind) variants.set(name, Number(variant));
    }
    const assignments: ApexAssignment[] = [];
    for (const [name, variant] of variants) {
        if (!Number.isInteger(variant) || variant <= 0) continue;
        const config = defaults[name]?.config;
        assignments.push([murmur(name), variant, 0, 1, variant, config ? JSON.stringify(config) : undefined]);
    }
    return assignments;
}

export function getApexExperiments(userId?: string, units: { installationId?: string; guildIds?: string[] } = {}) {
    const assignments: Record<number, Record<string, { evaluation_id: null; assignments: ApexAssignment[] }>> = {};
    const add = (kind: Kind, ids: (string | undefined)[]) => {
        const list = ids.filter((id): id is string => !!id);
        if (!list.length) return;
        const values = assignmentsFor(kind);
        assignments[UNIT[kind]] = Object.fromEntries(list.map((id) => [id, { evaluation_id: null, assignments: values }]));
    };
    add("user", [userId]);
    add("installation", [units.installationId]);
    add("guild", units.guildIds ?? []);
    return { assignments };
}

// legacy experiments: user tuples are [hash, revision, bucket, override (0 = forced), population, hash result, aa mode, trigger debugging];
// guild tuples are [hash, hash key, revision, populations, overrides, formatted overrides] with one population covering every guild
export function getLegacyExperiments() {
    const experiments: (number | null)[][] = [];
    const guild_experiments: unknown[][] = [];
    for (const { id, kind, bucket } of getCatalog().legacy) {
        if (isExcluded(id)) continue;
        if (kind === "user") experiments.push([murmur(id), 0, bucket, 0, 0, -1, 0, 0]);
        else guild_experiments.push([murmur(id), null, 0, [[[[bucket, [{ s: 0, e: 10000 }]]], []]], [], []]);
    }
    return { experiments, guild_experiments };
}
