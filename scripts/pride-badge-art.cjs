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

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const flags = [
    ["rainbow", "Rainbow", ["E40303", "FF8C00", "FFED00", "008026", "004DFF", "750787"]],
    ["original-rainbow", "Original rainbow (eight stripes)", ["FF69B4", "E40303", "FF8C00", "FFED00", "008026", "00C0C0", "0000FF", "750787"]],
    ["philadelphia", "Philadelphia", ["000000", "784F17", "E40303", "FF8C00", "FFED00", "008026", "004DFF", "750787"]],
    ["progress", "Progress", ["E40303", "FF8C00", "FFED00", "008026", "004DFF", "750787"]],
    ["intersex-progress", "Intersex-inclusive Progress", ["E40303", "FF8C00", "FFED00", "008026", "004DFF", "750787"]],
    ["transgender", "Transgender", ["5BCEFA", "F5A9B8", "FFFFFF", "F5A9B8", "5BCEFA"]],
    ["bisexual", "Bisexual", ["D60270", "9B4F96", "0038A8"]],
    ["pansexual", "Pansexual", ["FF218C", "FFD800", "21B1FF"]],
    ["lesbian-five", "Lesbian (five stripes)", ["D52D00", "FF9A56", "FFFFFF", "D162A4", "A30262"]],
    ["lesbian-seven", "Lesbian (seven stripes)", ["D52D00", "EF7627", "FF9A56", "FFFFFF", "D162A4", "B55690", "A30262"]],
    ["gay-five", "Gay men (five stripes)", ["078D70", "98E8C1", "FFFFFF", "7BADE2", "3D1A78"]],
    ["gay-seven", "Gay men (seven stripes)", ["078D70", "26CEAA", "98E8C1", "FFFFFF", "7BADE2", "5049CC", "3D1A78"]],
    ["asexual", "Asexual", ["000000", "A3A3A3", "FFFFFF", "800080"]],
    ["aromantic", "Aromantic", ["3DA542", "A7D379", "FFFFFF", "A9A9A9", "000000"]],
    ["aroace", "Aroace (sunset)", ["D29023", "E5CC32", "FFFFFF", "7AADDA", "273855"]],
    ["agender", "Agender", ["000000", "B9B9B9", "FFFFFF", "B8F483", "FFFFFF", "B9B9B9", "000000"]],
    ["nonbinary", "Nonbinary", ["FFF430", "FFFFFF", "9C59D1", "000000"]],
    ["genderqueer", "Genderqueer", ["B57EDC", "FFFFFF", "4A8123"]],
    ["genderfluid", "Genderfluid", ["FF75A2", "FFFFFF", "BE18D6", "000000", "333EBD"]],
    ["demiboy", "Demiboy", ["7F7F7F", "C4C4C4", "9AD9EA", "FFFFFF", "9AD9EA", "C4C4C4", "7F7F7F"]],
    ["demigirl", "Demigirl", ["7F7F7F", "C4C4C4", "FFAEC9", "FFFFFF", "FFAEC9", "C4C4C4", "7F7F7F"]],
    ["demigender", "Demigender", ["7F7F7F", "C2C2C2", "FFE111", "FFFFFF", "FFE111", "C2C2C2", "7F7F7F"]],
    ["demisexual", "Demisexual", ["FFFFFF", "800080", "A3A3A3"]],
    ["demiromantic", "Demiromantic", ["FFFFFF", "3DA542", "A3A3A3"]],
    ["gray-asexual", "Gray-asexual", ["740194", "A3A3A3", "FFFFFF", "A3A3A3", "740194"]],
    ["grayromantic", "Grayromantic", ["3DA542", "A3A3A3", "FFFFFF", "A3A3A3", "3DA542"]],
    ["polysexual", "Polysexual", ["F61CB9", "07D569", "1C92F6"]],
    ["omnisexual", "Omnisexual", ["FF9ACE", "FF53BF", "200044", "6760FE", "8EA6FF"]],
    ["intersex", "Intersex", ["FFD800"]],
    ["abrosexual", "Abrosexual", ["74C892", "B3E2C9", "FFFFFF", "E493B3", "D84370"]],
    ["unlabeled", "Unlabeled", ["E7F9E3", "FDFDFB", "DDEFF7", "FAE1C2"]],
    ["neutrois", "Neutrois", ["FFFFFF", "24AE4D", "000000"]],
    ["androgyne", "Androgyne", ["FD027F", "9832FF", "00B8E7"]],
];

const root = path.resolve(__dirname, "..");
const check = process.argv.includes("--check");
const vendor = path.join(root, "assets", "badge-icons", "twemoji-flags");
const manifest = JSON.parse(fs.readFileSync(path.join(vendor, "manifest.json"), "utf8"));
const upstreamSlugs = new Set(manifest.flags.map((flag) => flag.slug));
const template = fs.readFileSync(path.join(vendor, "flags", manifest.template.file), "utf8");
if (createHash("sha256").update(template).digest("hex") !== manifest.template.sha256) throw new Error("Vendored template checksum mismatch");
const silhouette = template.match(/\bd="([^"]+)"/)[1];
const number = (value) => Number(value.toFixed(6));
let stale = 0;
for (const [slug, title, colors] of flags) {
    if (upstreamSlugs.has(slug)) continue;
    const parts = [];
    let symbol = "";
    const sizes = slug === "bisexual" ? [40, 20, 40] : ["demisexual", "demiromantic"].includes(slug) ? [37.5, 25, 37.5] : colors.map(() => 100 / colors.length);
    let offset = 0;
    for (const [index, color] of colors.entries()) {
        const size = sizes[index];
        parts.push(
            slug === "androgyne"
                ? `<rect x="${number(offset * 1.5)}" width="${number(size * 1.5 + 0.01)}" height="100" fill="#${color}"/>`
                : `<rect y="${number(offset)}" width="150" height="${number(size + 0.01)}" fill="#${color}"/>`,
        );
        offset += size;
    }
    if (["demisexual", "demiromantic"].includes(slug)) parts.push('<path d="M0 0L65 50L0 100Z" fill="#000000"/>');
    if (["progress", "intersex-progress"].includes(slug)) {
        const inclusive = slug === "intersex-progress";
        const tips = inclusive ? [83.4, 74.2, 65, 55.8, 46.6, 37.4] : [72, 60, 48, 36, 24];
        const chevronColors = ["000000", "784F17", "5BCEFA", "F5A9B8", "FFFFFF", "FFD800"];
        tips.forEach((tip, index) => {
            const span = tip * (inclusive ? 17 / 15 : 25 / 24);
            parts.push(`<path d="M0 ${number(50 - span)}L${tip} 50L0 ${number(50 + span)}Z" fill="#${chevronColors[index]}"/>`);
        });
        if (inclusive) symbol = '<circle cx="3.24" cy="18" r="2.4" fill="none" stroke="#7902AA" stroke-width="0.552"/>';
    }
    if (slug === "intersex") parts.push('<circle cx="75" cy="50" r="24.5" fill="none" stroke="#7902AA" stroke-width="8.9375"/>');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" role="img"><title>${title}</title><defs><clipPath id="flag"><path d="${silhouette}"/></clipPath></defs><g clip-path="url(#flag)"><g transform="translate(0 5) scale(.24 .26)">${parts.join("")}</g>${symbol}</g></svg>\n`;
    const file = path.join(root, "assets", "badge-icons", `pride_${slug.replaceAll("-", "_")}.svg`);
    if (check) {
        if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== svg) {
            console.error(`Out of date: ${path.relative(root, file)}`);
            stale++;
        }
    } else fs.writeFileSync(file, svg);
}
for (const flag of manifest.flags) {
    const source = fs.readFileSync(path.join(vendor, "flags", flag.file));
    if (createHash("sha256").update(source).digest("hex") !== flag.sha256) throw new Error(`Vendored artwork checksum mismatch: ${flag.file}`);
    const file = path.join(root, "assets", "badge-icons", `${flag.icon}.svg`);
    if (check) {
        if (!fs.existsSync(file) || !source.equals(fs.readFileSync(file))) {
            console.error(`Out of date: ${path.relative(root, file)}`);
            stale++;
        }
    } else fs.writeFileSync(file, source);
}
const supplemental = flags
    .filter(([slug]) => !upstreamSlugs.has(slug))
    .map(([slug]) => {
        const icon = `pride_${slug.replaceAll("-", "_")}`;
        return {
            slug,
            icon,
            sha256: createHash("sha256")
                .update(fs.readFileSync(path.join(root, "assets", "badge-icons", `${icon}.svg`)))
                .digest("hex"),
            derivedFrom: manifest.template.file,
        };
    });
if (check) {
    if (JSON.stringify(supplemental) !== JSON.stringify(manifest.supplementalFlags)) {
        console.error("Supplemental artwork manifest is out of date");
        stale++;
    }
} else {
    manifest.supplementalFlags = supplemental;
    fs.writeFileSync(path.join(vendor, "manifest.json"), `${JSON.stringify(manifest, null, 4)}\n`);
}
if (stale) process.exitCode = 1;
else
    console.log(
        `${check ? "Verified" : "Generated"} ${manifest.flags.length} Twemoji flags and ${flags.filter(([slug]) => !upstreamSlugs.has(slug)).length} supplemental badge SVGs.`,
    );
