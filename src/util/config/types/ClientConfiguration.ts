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

export class ClientConfiguration {
    useTestClient: boolean = true;
    instanceName: string = "@lathandh";
    icon: string | null = null;
    logo: string | null = null;
    helpUrl: string | null = null;
    activityApplicationHost: string | null = null;
    loadingTips: string[] | null = null;
    loadingSvg: string | null = null;
    experiments: Record<string, number> = {};
    // turn on every experiment the downloaded client defines (assets/cache/experiments.json, from scripts/experiments.js)
    rolloutAllExperiments: boolean = true;
    // experiment names or ids left out of that rollout; a trailing * matches a prefix
    experimentExclusions: string[] = [
        "2026-03-icymi-*", // "In case you missed it"
        "2026-04-icymi-*",
        "2026-04-desktop-notification-center", // notifications button above the server list
        "2026-01-cms-layouts", // Shop pages from Discord's CMS, which this server does not serve
        "2026-06-improved-shop-loading", // Shop tab layouts, same reason
    ];
}
