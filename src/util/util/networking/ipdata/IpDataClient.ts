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

import { DateBuilder } from "@spacebar/extensions";
import { Config } from "@spacebar/util";
import { IpDataIpLookupResponse } from "./IpDataSampleResponses";

export class IpDataClient {
    private static ipInfoCache: Map<
        string,
        {
            data: IpDataIpLookupResponse;
            expires: number;
        }
    > = new Map();

    static async getIpInfo(ip: string): Promise<IpDataIpLookupResponse | null> {
        if (!Config.get().externalRequests.thirdParty) return null;
        const { ipdataApiKey } = Config.get().security;
        if (!ipdataApiKey) return null;
        if ((this.ipInfoCache.get(ip)?.expires ?? 0) > Date.now()) return this.ipInfoCache.get(ip)!.data;

        const response = await fetch(`https://eu-api.ipdata.co/${encodeURIComponent(ip)}?api-key=${encodeURIComponent(ipdataApiKey)}`, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return null;
        const data = (await response.json()) as IpDataIpLookupResponse;
        this.ipInfoCache.set(ip, {
            data: data,
            expires: new DateBuilder().addHours(12).buildTimestamp(),
        });
        return data;
    }
}
