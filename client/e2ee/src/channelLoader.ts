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

interface ChannelLoaderOptions<T> {
    current: () => string | null;
    load: (channelId: string) => Promise<T>;
    receive: (channelId: string, value: T) => void;
    retry: () => void;
    retryMs?: number;
}

export function createChannelLoader<T>({ current, load, receive, retry, retryMs = 5000 }: ChannelLoaderOptions<T>) {
    const pending = new Map<string, Promise<void>>();
    let failed: { channelId: string; after: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (channelId: string) => {
        if (pending.has(channelId) || (failed?.channelId === channelId && Date.now() < failed.after)) return;
        const task = Promise.resolve()
            .then(() => load(channelId))
            .then((value) => {
                if (current() !== channelId) return;
                failed = null;
                receive(channelId, value);
            })
            .catch(() => {
                if (current() !== channelId) return;
                failed = { channelId, after: Date.now() + retryMs };
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    timer = null;
                    if (current() === channelId) retry();
                }, retryMs);
            })
            .finally(() => pending.delete(channelId));
        pending.set(channelId, task);
    };
}
