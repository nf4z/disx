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

import { MigrationInterface, QueryRunner } from "typeorm";

export class StorageQuotaLedger1791099000000 implements MigrationInterface {
    name = "StorageQuotaLedger1791099000000";
    async up(runner: QueryRunner): Promise<void> {
        await runner.query(`CREATE TABLE storage_quota_accounts (
            namespace varchar NOT NULL, key varchar NOT NULL,
            used_bytes bigint NOT NULL DEFAULT 0 CHECK (used_bytes >= 0), reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
            used_objects bigint NOT NULL DEFAULT 0 CHECK (used_objects >= 0), reserved_objects bigint NOT NULL DEFAULT 0 CHECK (reserved_objects >= 0),
            state varchar NOT NULL DEFAULT 'inventory-required', PRIMARY KEY(namespace, key))`);
        await runner.query(`CREATE TABLE storage_quota_objects (
            namespace varchar NOT NULL, path varchar NOT NULL, principal varchar NOT NULL, category varchar NOT NULL,
            bytes bigint NOT NULL DEFAULT 0 CHECK (bytes >= 0), generation varchar NOT NULL,
            pending_operation varchar, state varchar NOT NULL DEFAULT 'reserved', PRIMARY KEY(namespace, path))`);
        await runner.query(`CREATE TABLE storage_quota_operations (
            namespace varchar NOT NULL, id varchar NOT NULL, path varchar NOT NULL, principal varchar NOT NULL, category varchar NOT NULL,
            upper_bytes bigint NOT NULL CHECK (upper_bytes >= 0), prior_bytes bigint NOT NULL CHECK (prior_bytes >= 0),
            prior_exists boolean NOT NULL, prior_generation varchar NOT NULL, state varchar NOT NULL DEFAULT 'reserved',
            actual_bytes bigint CHECK (actual_bytes >= 0), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(namespace, id))`);
        await runner.query(`CREATE INDEX storage_quota_operations_recovery ON storage_quota_operations(namespace, state, created_at)`);
    }
    async down(runner: QueryRunner): Promise<void> {
        await runner.query("DROP TABLE storage_quota_operations");
        await runner.query("DROP TABLE storage_quota_objects");
        await runner.query("DROP TABLE storage_quota_accounts");
    }
}
