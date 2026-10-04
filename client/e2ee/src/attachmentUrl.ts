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

export const attachmentCiphertextUrl = (value: string, channelId: string, filename: string, origin: string): string | null => {
    let url: URL;
    try {
        url = new URL(value, origin);
    } catch {
        return null;
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const opened = new URL(origin);
    const localHost = /^(?:localhost|[\w.-]+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])$/i.test(url.hostname);
    if (url.host !== opened.host && !localHost) return value;
    if (!/^\d+$/.test(channelId)) return null;
    const path = /^\/attachments\/(\d+)\/(\d+)\/([^/]+)$/.exec(url.pathname);
    if (!path || path[1] !== channelId) return null;
    try {
        const decoded = decodeURIComponent(path[3]);
        if (/[/\\\0]/.test(decoded) || decoded !== filename) return null;
    } catch {
        return null;
    }
    return `${opened.origin}${url.pathname}${url.search}${url.hash}`;
};
