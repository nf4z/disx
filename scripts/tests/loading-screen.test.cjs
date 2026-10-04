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

require("../register-paths.cjs");

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validateLoadingSvg, validateLoadingTips } = require("../../dist/util/util/LoadingScreen.js");

const animation =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="red"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/></circle></svg>';

test("accepts local animated SVG and restores empty defaults", () => {
    assert.equal(validateLoadingSvg(animation), animation);
    assert.equal(validateLoadingSvg(null), null);
    assert.equal(validateLoadingSvg(""), null);
    assert.deepEqual(validateLoadingTips(["  first  ", "", "second"]), ["first", "second"]);
    assert.equal(validateLoadingTips([]), null);
});

test("rejects executable markup, external resources and malformed XML", () => {
    for (const svg of [
        "<svg><script>alert(1)</script></svg>",
        '<svg onload="alert(1)"></svg>',
        "<svg><foreignObject><div>html</div></foreignObject></svg>",
        '<svg><use href="https://example.com/a.svg#id"/></svg>',
        '<svg><use href="&#104;ttps://example.com/a.svg#id"/></svg>',
        '<svg><path fill="url(https://example.com/a.svg)"/></svg>',
        '<svg><style>@import "https://example.com/a.css"</style></svg>',
        "<!DOCTYPE svg><svg/>",
        "<svg><g></svg>",
        "<svg/><svg/>",
        '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    ])
        assert.throws(
            () => validateLoadingSvg(svg),
            (error) => error.code === 400,
            svg,
        );
});

test("permits local gradients and fragment references without network access", () => {
    const svg = '<svg><defs><linearGradient id="color"><stop offset="0" stop-color="red"/></linearGradient></defs><path fill="url(#color)" d="M0 0"/></svg>';
    assert.equal(validateLoadingSvg(svg), svg);
});

test("bounds source bytes, nesting, nodes and tip lengths/count", () => {
    assert.throws(() => validateLoadingSvg("<svg>" + " ".repeat(65536) + "</svg>"));
    assert.throws(() => validateLoadingSvg("<svg>" + "<g>".repeat(65) + "</g>".repeat(65) + "</svg>"));
    assert.throws(() => validateLoadingSvg("<svg>" + "<path/>".repeat(1001) + "</svg>"));
    assert.throws(() => validateLoadingTips(Array(101).fill("tip")));
    assert.throws(() => validateLoadingTips(["x".repeat(501)]));
    assert.throws(() => validateLoadingTips([1]));
});
