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
export class AnnouncementDelivery1791805000427 implements MigrationInterface {
    name = "AnnouncementDelivery1791805000427";
    async up(runner: QueryRunner): Promise<void> {
        await runner.query(`ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "durable" boolean NOT NULL DEFAULT false`);
        await runner.query(`ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "attachment_count" integer NOT NULL DEFAULT 0`);
        await runner.query(`CREATE TABLE IF NOT EXISTS "announcement_deliveries" (
            "announcement_id" bigint NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
            "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "status" varchar NOT NULL DEFAULT 'queued', "attempts" integer NOT NULL DEFAULT 0,
            "next_retry_at" timestamptz NOT NULL DEFAULT now(), "last_error" varchar,
            "message_id" bigint, "lease_token" varchar, PRIMARY KEY ("announcement_id", "user_id")
        )`);
        await runner.query(`ALTER TABLE "announcement_deliveries" ADD COLUMN IF NOT EXISTS "lease_token" varchar`);
        await runner.query(`CREATE INDEX IF NOT EXISTS "IDX_announcement_deliveries_ready" ON "announcement_deliveries" ("status", "next_retry_at")`);
    }
    async down(runner: QueryRunner): Promise<void> {
        await runner.query(`DROP TABLE IF EXISTS "announcement_deliveries"`);
        await runner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "durable"`);
        await runner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "attachment_count"`);
    }
}
