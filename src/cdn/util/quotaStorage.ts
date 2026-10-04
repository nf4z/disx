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

import { HTTPError } from "lambert-server/HTTPError";
import { StorageQuotaLedger, StorageQuotaRequest } from "./storageQuota";

export interface QuotaWriteResult {
    bytes: bigint;
    generation: string;
}
export interface QuotaStorageAdapter {
    write(request: StorageQuotaRequest, data: Buffer): Promise<QuotaWriteResult>;
    clone(request: StorageQuotaRequest, source: { path: string; generation: string }): Promise<QuotaWriteResult>;
    unchanged(request: StorageQuotaRequest): Promise<boolean>;
    remove(path: string, generation: string): Promise<void>;
}
export class QuotaStorageCoordinator {
    constructor(
        private ledger: StorageQuotaLedger,
        private adapter: QuotaStorageAdapter,
    ) {}
    async write(request: StorageQuotaRequest, data: Buffer): Promise<void> {
        await this.perform(request, () => this.adapter.write(request, data));
    }
    async clone(request: StorageQuotaRequest, source: { path: string; generation: string }): Promise<void> {
        await this.perform(request, () => this.adapter.clone(request, source));
    }
    private async perform(request: StorageQuotaRequest, write: () => Promise<QuotaWriteResult>): Promise<void> {
        const reservation = await this.ledger.reserve(request);
        if (!reservation.created) {
            if (reservation.operation.state === "complete") return;
            throw new HTTPError("Storage operation requires recovery", 409);
        }
        try {
            const result = await write();
            if (result.generation !== request.id) throw new HTTPError("Storage generation mismatch", 503);
            await this.ledger.finalize(request.namespace, request.id, result.bytes);
        } catch (error) {
            if (await this.adapter.unchanged(request).catch(() => false)) await this.ledger.cancelUnchanged(request.namespace, request.id);
            throw error;
        }
    }
    async delete(namespace: string, path: string, generation: string): Promise<void> {
        await this.ledger.deleteConfirmed(namespace, path, generation, () => this.adapter.remove(path, generation));
    }
}
