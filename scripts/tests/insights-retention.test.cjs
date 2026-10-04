/*
    Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
    Copyright (C) 2026 Spacebar and Spacebar Contributors

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { Pool } = require("pg");
const { DataSource } = require("typeorm");

function loadInsights(query) {
    const filename = path.resolve(__dirname, "../../src/database/insights/GuildInsights.ts");
    const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(
        js,
        {
            module,
            exports: module.exports,
            console,
            require(name) {
                if (name === "../Database") return { getDatabase: () => ({ query }) };
                if (name === "@spacebar/util/util/Snowflake") return { Snowflake: { EPOCH: 1420070400000 } };
                throw new Error(`Unexpected import: ${name}`);
            },
        },
        { filename },
    );
    return module.exports.GuildInsights;
}

const DAY = 86_400_000;
const normalize = (value) => JSON.parse(JSON.stringify(value));

test("historical retention reads one grouped membership scan with unchanged cohort semantics", { skip: !process.env.INSIGHTS_TEST_DATABASE, timeout: 30_000 }, async (t) => {
    const schema = `insights_retention_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: process.env.INSIGHTS_TEST_DATABASE, max: 1 });
    let ds;
    try {
        await admin.query(`CREATE SCHEMA "${schema}"`);
        ds = new DataSource({ type: "postgres", url: process.env.INSIGHTS_TEST_DATABASE, poolSize: 1, extra: { options: `-c search_path=${schema}` } });
        await ds.initialize();
        const today = new Date().toISOString().slice(0, 10);
        const dayAt = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
        const start = dayAt(-107);
        const end = dayAt(-8);
        await ds.query(`CREATE TABLE members (guild_id bigint, id bigint, joined_at timestamp NOT NULL, PRIMARY KEY (id, guild_id))`);
        await ds.query(`CREATE INDEX ON members (guild_id)`);
        await ds.query(`CREATE TABLE guild_insights_daily (guild_id bigint, day date, metric varchar, key varchar, value bigint)`);
        await ds.query(`CREATE TABLE guild_insights_rollups (day date)`);
        await ds.query(`CREATE TABLE voice_states (guild_id bigint, channel_id bigint, connected_at bigint)`);
        await ds.query(
            `INSERT INTO members SELECT g, d * 10000 + u, $1::date + d * interval '1 day' + (u - 1) * interval '86.4 seconds'
            FROM generate_series(0, 99) d CROSS JOIN generate_series(1, 1000) u CROSS JOIN generate_series(1, 2) g`,
            [start],
        );
        await ds.query(`INSERT INTO guild_insights_daily SELECT 1, $1::date + d * interval '1 day', 'joins', '', 1100 FROM generate_series(0, 99) d`, [start]);
        await ds.query(`ANALYZE members`);
        let queries = 0;
        let sqlMs = 0;
        const query = async (sql, parameters) => {
            queries++;
            const started = performance.now();
            try {
                return await ds.query(sql, parameters);
            } finally {
                sqlMs += performance.now() - started;
            }
        };
        const Insights = loadInsights(query);
        await t.test("100 cohort queries become one query and match the existing per-day result", async () => {
            const baseline = new Map();
            queries = 0;
            sqlMs = 0;
            for (let i = 0; i < 100; i++) {
                const day = dayAt(-107 + i);
                baseline.set(day, (await Insights.retained(day, "1")).get("1") ?? 0);
            }
            assert.equal(queries, 100);
            const baselineSqlMs = sqlMs;
            queries = 0;
            sqlMs = 0;
            const grouped = await Insights.retainedByDay("1", start, dayAt(-7));
            assert.equal(queries, 1);
            assert.deepEqual(normalize([...grouped].sort()), normalize([...baseline].sort()));
            t.diagnostic(JSON.stringify({ fixtureMembers: 200_000, cohortDays: 100, baselineQueries: 100, groupedQueries: 1, baselineSqlMs, groupedSqlMs: sqlMs }));
        });

        await t.test("daily reports use four queries across all 100 cohorts", async () => {
            queries = 0;
            sqlMs = 0;
            const daily = await Insights.daily("1", start, end);
            assert.equal(queries, 4);
            assert.equal(daily.size, 100);
            for (const metrics of daily.values()) assert.equal(metrics.retained[""], 1000);
            t.diagnostic(JSON.stringify({ dailyQueries: queries, dailySqlMs: sqlMs }));
        });

        await t.test("UTC half-open edges, zero-member cohorts and stored counts retain their behavior", async () => {
            const emptyDay = dayAt(-57);
            const storedDay = dayAt(-77);
            const noJoinsDay = dayAt(-67);
            await ds.query(`DELETE FROM members WHERE guild_id = 1 AND joined_at >= $1::date AND joined_at < $1::date + interval '1 day'`, [emptyDay]);
            await ds.query(
                `INSERT INTO members VALUES (1, 2000001, $1::date - interval '1 millisecond'), (1, 2000002, $1::date),
                (1, 2000003, $2::date + interval '1 day' - interval '1 millisecond'), (1, 2000004, $2::date + interval '1 day')`,
                [start, end],
            );
            await ds.query(`INSERT INTO guild_insights_daily VALUES (1, $1, 'retained', '', 77)`, [storedDay]);
            await ds.query(`UPDATE guild_insights_daily SET value = 0 WHERE day = $1 AND metric = 'joins'`, [noJoinsDay]);
            await ds.query(`INSERT INTO guild_insights_daily VALUES (1, $1, 'joins', '', 1)`, [dayAt(-7)]);
            await ds.query(`SET TIME ZONE 'America/Los_Angeles'`);
            queries = 0;
            const daily = await Insights.daily("1", start, dayAt(-7));
            assert.equal(queries, 4);
            assert.equal(daily.get(start).retained[""], 1001);
            assert.equal(daily.get(end).retained[""], 1001);
            assert.equal(daily.get(emptyDay).retained[""], 0);
            assert.equal(daily.get(storedDay).retained[""], 77);
            assert.equal(daily.get(noJoinsDay).retained, undefined);
            assert.equal(daily.get(dayAt(-7)).retained, undefined);
            assert.deepEqual(normalize(daily.get(start).joins), { "": 1100 });
        });

        await t.test("stored retention for every eligible day avoids the fallback query", async () => {
            await ds.query(
                `INSERT INTO guild_insights_daily SELECT 1, $1::date + d * interval '1 day', 'retained', '', 9 FROM generate_series(0, 99) d
                WHERE NOT EXISTS (SELECT 1 FROM guild_insights_daily WHERE day = $1::date + d * interval '1 day' AND metric = 'retained')`,
                [start],
            );
            queries = 0;
            await Insights.daily("1", start, end);
            assert.equal(queries, 3);
        });
    } finally {
        if (ds?.isInitialized) await ds.destroy();
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.end();
    }
});
