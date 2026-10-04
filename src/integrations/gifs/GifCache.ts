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

export class GifCache<T> {
    private expires = 0;
    private value: T;
    private pending?: Promise<T>;
    constructor(private duration: number) {}
    getOrUpdate(factory: () => Promise<T>): Promise<T> {
        if (this.expires > Date.now()) return Promise.resolve(this.value);
        if (this.pending) return this.pending;
        this.pending = factory()
            .then((value) => {
                this.value = value;
                this.expires = Date.now() + this.duration;
                return value;
            })
            .finally(() => {
                this.pending = undefined;
            });
        return this.pending;
    }
}
