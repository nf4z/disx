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

import { MigrationInterface, QueryRunner } from "typeorm";

export class ScheduledMessageDeliveryLease1791568734927 implements MigrationInterface {
    name = "ScheduledMessageDeliveryLease1791568734927";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scheduled_messages" ADD COLUMN IF NOT EXISTS "claim_token" uuid`);
        await queryRunner.query(`ALTER TABLE "scheduled_messages" ADD COLUMN IF NOT EXISTS "claim_until" timestamp with time zone`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scheduled_messages" DROP COLUMN IF EXISTS "claim_until"`);
        await queryRunner.query(`ALTER TABLE "scheduled_messages" DROP COLUMN IF EXISTS "claim_token"`);
    }
}
