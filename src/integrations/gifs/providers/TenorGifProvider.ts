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

import fs from "node:fs/promises";
import { Config } from "@spacebar/util";
import type { GifsResponse, GifTrendingCategory } from "@spacebar/schemas";
import type { IGifProvider } from "../IGifProvider";

type Media = { url: string; dims: [number, number]; preview?: string };
type Result = { id: string; title?: string; h1_title?: string; itemurl: string; media: Record<string, Media>[] };
export default class TenorGifProvider implements IGifProvider {
    id = "tenor";
    available = false;
    private key = "";
    async init() {
        const config = Config.get().integrations.gifs.tenor;
        this.key = config.apiKey || (config.apiKeyPath ? await fs.readFile(config.apiKeyPath, "utf8").catch(() => "") : "");
        this.key = this.key.trim();
        this.available = config.enabled && !!this.key;
    }
    private async request(endpoint: string, params: Record<string, string>) {
        const response = await fetch(`https://api.tenor.com/v1/${endpoint}?${new URLSearchParams({ key: this.key, ...params })}`, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`Tenor request failed (${response.status})`);
        return response.json() as Promise<{ results: Result[] & string[]; tags?: { searchterm: string; image: string }[] }>;
    }
    private convert(item: Result, format: string) {
        const media = item.media?.[0];
        const gif = media?.gif;
        const selected = media?.[format === "gif" ? "gif" : format === "tinywebp" ? "webp" : "tinywebm"] || media?.mp4 || gif;
        if (!gif || !selected) return [];
        return [
            {
                id: item.id,
                title: item.title || item.h1_title || "",
                url: item.itemurl,
                src: selected.url,
                gif_src: gif.url,
                width: selected.dims[0],
                height: selected.dims[1],
                preview: selected.preview || gif.url,
            },
        ];
    }
    async search(query: { q: string; limit?: number; media_format: string; locale: string }): Promise<GifsResponse> {
        const data = await this.request("search", { q: query.q, limit: String(Math.max(1, Math.min(50, Number(query.limit) || 50))), locale: query.locale || "en_US" });
        return (data.results as Result[]).flatMap((item) => this.convert(item, query.media_format));
    }
    async getTrendingGifs(query: { media_format: string; locale: string }): Promise<GifsResponse> {
        const data = await this.request("trending", { limit: "50", locale: query.locale || "en_US" });
        return (data.results as Result[]).flatMap((item) => this.convert(item, query.media_format));
    }
    async getTrendingCategories(query: { locale: string }): Promise<GifTrendingCategory[]> {
        const data = await this.request("categories", { type: "featured", locale: query.locale || "en_US" });
        return (data.tags || []).map((tag: { searchterm: string; image: string }) => ({ name: tag.searchterm, src: tag.image }));
    }
    async suggest(query: { q: string; limit: number; locale: string }): Promise<string[]> {
        const data = await this.request("search_suggestions", { q: query.q, limit: String(Math.max(1, Math.min(10, query.limit))), locale: query.locale || "en_US" });
        return data.results || [];
    }
}
