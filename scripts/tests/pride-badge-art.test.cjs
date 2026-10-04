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
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const sharp = require("sharp");
const root = path.resolve(__dirname, "../..");
const svg = (slug) => fs.readFileSync(path.join(root, "assets/badge-icons", `pride_${slug}.svg`));
const raster = async (slug) => sharp(svg(slug)).resize(1500, 1000).removeAlpha().raw().toBuffer();
const pixel = (data, x, y) =>
    `#${data
        .subarray((y * 1500 + x) * 3, (y * 1500 + x) * 3 + 3)
        .toString("hex")
        .toUpperCase()}`;

test("all 33 local SVGs match their offline generator and render without external resources", async () => {
    execFileSync(process.execPath, ["scripts/pride-badge-art.cjs", "--check"], { cwd: root });
    const files = fs.readdirSync(path.join(root, "assets/badge-icons")).filter((file) => /^pride_.*\.svg$/.test(file));
    assert.equal(files.length, 33);
    for (const file of files) {
        const content = fs.readFileSync(path.join(root, "assets/badge-icons", file));
        assert.doesNotMatch(content.toString(), /<(?:script|image|foreignObject)\b|(?:href|url)\s*[=(]/i);
        assert.match(content.toString(), /viewBox="0 0 150 100"/);
        const rendered = await sharp(content).resize(30, 20).png().toBuffer();
        assert.ok(rendered.length > 50);
    }
});

test("Progress chevron leaves the correct narrower white triangle and rainbow field", async () => {
    const image = await raster("progress");
    for (const [x, color] of [
        [100, "#FFFFFF"],
        [300, "#F5A9B8"],
        [420, "#5BCEFA"],
        [540, "#784F17"],
        [660, "#000000"],
        [900, "#008026"],
    ]) {
        assert.equal(pixel(image, x, 505), color);
    }
});

test("intersex-inclusive Progress has an unbroken unclipped circle inside the yellow chevron", async () => {
    const image = await raster("intersex_progress");
    for (const [x, color] of [
        [5, "#FFD800"],
        [35, "#7902AA"],
        [135, "#FFD800"],
        [235, "#7902AA"],
        [300, "#FFD800"],
        [420, "#FFFFFF"],
        [510, "#F5A9B8"],
        [600, "#5BCEFA"],
        [700, "#784F17"],
        [790, "#000000"],
        [1000, "#008026"],
    ]) {
        assert.equal(pixel(image, x, 505), color);
    }
    assert.equal(pixel(image, 135, 400), "#7902AA");
    assert.equal(pixel(image, 135, 600), "#7902AA");
});

test("standalone intersex preserves creator colors and circle proportions", async () => {
    const image = await raster("intersex");
    assert.equal(pixel(image, 750, 500), "#FFD800");
    assert.equal(pixel(image, 750, 255), "#7902AA");
    assert.equal(pixel(image, 750, 200), "#FFD800");
    assert.match(svg("intersex").toString(), /r="24.5".*stroke="#7902AA" stroke-width="8.9375"/);
});
