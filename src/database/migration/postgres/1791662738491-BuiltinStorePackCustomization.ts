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

export class BuiltinStorePackCustomization1791662738491 implements MigrationInterface {
    name = "BuiltinStorePackCustomization1791662738491";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_hidden_packs" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "store_hidden_packs" ADD COLUMN IF NOT EXISTS "customization" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'store_hidden_packs' AND column_name = 'hidden') THEN DELETE FROM "store_hidden_packs" WHERE "hidden" = false; END IF; END $$`,
        );
        await queryRunner.query(`ALTER TABLE "store_hidden_packs" DROP COLUMN IF EXISTS "customization"`);
        await queryRunner.query(`ALTER TABLE "store_hidden_packs" DROP COLUMN IF EXISTS "hidden"`);
    }
}
