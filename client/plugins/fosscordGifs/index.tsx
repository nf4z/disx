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

import definePlugin from "@utils/types";
import { React, RestAPI, useState } from "@webpack/common";
import { FosscordAuthor } from "../fosscordCore/shared";

const storageKey = "fosscord.gifProvider";
let defaultProvider = "klipy";
let providers: Record<string, { available: boolean }> = {};
function selectedProvider() {
    const value = localStorage.getItem(storageKey);
    return value === "tenor" || value === "klipy" ? value : defaultProvider;
}
function ProviderSelect() {
    const [provider, setProvider] = useState(selectedProvider);
    return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, color: "var(--text-default)" }}>
            <span>GIF provider</span>
            <select
                aria-label="GIF provider"
                title="Search again after changing provider"
                value={provider}
                onChange={(event) => {
                    localStorage.setItem(storageKey, event.currentTarget.value);
                    setProvider(event.currentTarget.value);
                }}
                style={{ color: "var(--text-default)", background: "var(--background-base-low)", border: "1px solid var(--border-subtle)", borderRadius: 6, minHeight: 32 }}
            >
                <option value="klipy">Klipy{providers.klipy?.available ? "" : " (setup needed)"}</option>
                <option value="tenor">Tenor</option>
            </select>
        </label>
    );
}
export default definePlugin({
    name: "FosscordGifs",
    description: "Choose Klipy or Tenor in the native GIF picker using this instance's GIF service.",
    authors: [FosscordAuthor],
    required: true,
    patches: [
        {
            find: '"GIF_PICKER_TRENDING_FETCH_SUCCESS",trendingCategories:',
            replacement: {
                match: /(GIFS_(?:SEARCH|SUGGEST|TRENDING|TRENDING_GIFS),query:\{)/g,
                replace: "$1provider:$self.provider(),",
            },
        },
        {
            find: "renderHeaderContent()",
            replacement: {
                match: /children:\[(\i),this\.renderHeaderContent\(\)\]/,
                replace: "children:[$1,this.renderHeaderContent(),$self.renderProviderSelect()]",
            },
        },
    ],
    provider: selectedProvider,
    renderProviderSelect: () => React.createElement(ProviderSelect),
    async start() {
        try {
            const { body } = await RestAPI.get({ url: "/gifs/providers" });
            providers = body.providers || {};
            if (body.defaultProvider === "tenor" || body.defaultProvider === "klipy") defaultProvider = body.defaultProvider;
        } catch {}
    },
});
