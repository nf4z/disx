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

export class AdminUserSearchIndexes1791662548137 implements MigrationInterface {
    name = "AdminUserSearchIndexes1791662548137";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_admin_created_id" ON "users" ("created_at" DESC, "id" DESC)`);
        await queryRunner.query(
            `DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_trgm; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_trgm is unavailable, admin user substring search stays unindexed'; END $$`,
        );
        for (const column of ["username", "global_name", "email"]) {
            await queryRunner.query(
                `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN CREATE INDEX IF NOT EXISTS "IDX_users_admin_${column}_trgm" ON "users" USING gin ("${column}" gin_trgm_ops); END IF; END $$`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const column of ["username", "global_name", "email"]) await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_admin_${column}_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_admin_created_id"`);
    }
}
