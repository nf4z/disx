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

import { Config } from "@spacebar/util";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { IGifProvider } from "./IGifProvider";

export class GifProviderManager {
    private static _providers: Map<string, IGifProvider> = new Map<string, IGifProvider>();
    public static async init() {
        if (!Config.get().integrations.gifs.enabled) {
            this._providers.clear();
            return;
        }
        const providers = new Map<string, IGifProvider>();
        console.log("[GifProviderManager] Initialising providers...");
        const providerImports = await Promise.all(
            (await fs.readdir(path.join(__dirname, "providers"))) /**/
                .filter((p) => p.endsWith(".js"))
                .map((f) => import(pathToFileURL(path.join(__dirname, "providers", f)).href)),
        );

        for (const providerImport of providerImports) {
            const provider = new providerImport.default.default() as IGifProvider;
            console.log(`[GifProviderManager] Got provider with id ${provider.id}, calling init...`);
            try {
                await provider.init();
            } catch {
                provider.available = false;
            }
            console.log(`[GifProviderManager] Initialized '${provider.id}' - Available:`, provider.available);
            if (provider.available) providers.set(provider.id, provider);
            console.log(`[GifProviderManager] Initialized`, providers.size, "/", providerImports.length, "GIF providers...");
        }

        this._providers = providers;
        console.log("[GifProviderManager] Ready with", this._providers.size, "available providers!");
    }

    public static getProvider(id: string): IGifProvider {
        if (!Config.get().integrations.gifs.enabled) throw new Error("External GIF providers are disabled by instance policy");
        if (this._providers.has(id)) return this._providers.get(id)!;

        throw new Error(`Unknown GIF provider, or it is not enabled: ${id}, known GIF providers: ${Array.from(this._providers.keys()).join(", ")}`);
    }

    public static findProvider(id?: string): IGifProvider | undefined {
        if (!Config.get().integrations.gifs.enabled) return undefined;
        return this._providers.get(id || Config.get().integrations.gifs.defaultProvider);
    }

    public static getProviders() {
        if (!Config.get().integrations.gifs.enabled) return {};
        const providers: { [key: string]: { available: boolean } } = {};
        for (const [id, provider] of this._providers) {
            providers[id] = {
                available: provider.available,
            };
        }

        return providers;
    }
}
