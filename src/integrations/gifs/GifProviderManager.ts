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
import type { IGifProvider } from "./IGifProvider";

export class GifProviderManager {
    private static _providers: Map<string, IGifProvider> = new Map<string, IGifProvider>();
    public static async init() {
        this._providers.clear();
        if (!Config.get().externalRequests.thirdParty) return;
        console.log("[GifProviderManager] Initialising providers...");
        const providerImports = await Promise.all(
            (await fs.readdir(path.join(__dirname, "providers"))) /**/
                .filter((p) => p.endsWith(".js"))
                .map((f) => import(path.join(__dirname, "providers", f))),
        );

        for (const providerImport of providerImports) {
            const provider = new providerImport.default.default() as IGifProvider;
            console.log(`[GifProviderManager] Got provider with id ${provider.id}, calling init...`);
            await provider.init();
            console.log(`[GifProviderManager] Initialized '${provider.id}' - Available:`, provider.available);
            if (provider.available) this._providers.set(provider.id, provider);
            console.log(`[GifProviderManager] Initialized`, this._providers.size, "/", providerImports.length, "GIF providers...");
        }

        console.log("[GifProviderManager] Ready with", this._providers.size, "available providers!");
    }

    public static getProvider(id: string): IGifProvider {
        if (!Config.get().externalRequests.thirdParty) throw new Error("External GIF providers are disabled by instance policy");
        if (id == "tenor") id = "klipy";
        if (this._providers.has(id)) return this._providers.get(id)!;

        throw new Error(`Unknown GIF provider, or it is not enabled: ${id}, known GIF providers: ${this._providers.keys().toArray().join(", ")}`);
    }

    public static findProvider(id?: string): IGifProvider | undefined {
        if (!Config.get().externalRequests.thirdParty) return undefined;
        if (!id || id == "tenor") id = "klipy";
        return this._providers.get(id) ?? this._providers.values().next().value;
    }

    public static getProviders() {
        if (!Config.get().externalRequests.thirdParty) return {};
        const providers: { [key: string]: { available: boolean } } = {};
        for (const [id, provider] of this._providers) {
            providers[id] = {
                available: provider.available,
            };
        }

        return providers;
    }
}
