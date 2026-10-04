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

export class E2eeRecovery1791804000000 implements MigrationInterface {
    name = "E2eeRecovery1791804000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "e2ee_recovery" (
            "user_id" bigint PRIMARY KEY,
            "identity_key" varchar NOT NULL,
            "backup_public_key" varchar NOT NULL,
            "backup_version" integer NOT NULL,
            "encrypted_secret" varchar NOT NULL,
            "updated_at" timestamp with time zone NOT NULL,
            CONSTRAINT "FK_e2ee_recovery_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "e2ee_recovery"`);
    }
}
