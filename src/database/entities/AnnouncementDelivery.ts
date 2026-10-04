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

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { BaseClassWithoutId } from "./BaseClass";
import { Announcement } from "./Announcement";
import { User } from "./User";

@Entity({ name: "announcement_deliveries" })
@Index("IDX_announcement_deliveries_ready", ["status", "next_retry_at"])
export class AnnouncementDelivery extends BaseClassWithoutId {
    @PrimaryColumn({ type: "int8" }) announcement_id: string;
    @PrimaryColumn({ type: "int8" }) user_id: string;
    @JoinColumn({ name: "announcement_id", foreignKeyConstraintName: "FK_announcement_deliveries_announcement" })
    @ManyToOne(() => Announcement, { onDelete: "CASCADE" })
    announcement: Announcement;
    @JoinColumn({ name: "user_id", foreignKeyConstraintName: "FK_announcement_deliveries_user" })
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    user: User;
    @Column({ type: "varchar", default: "queued" }) status: "queued" | "delivering" | "delivered" | "failed";
    @Column({ type: "int", default: 0 }) attempts: number;
    @Column({ type: "timestamptz", default: () => "now()" }) next_retry_at: Date;
    @Column({ type: "varchar", nullable: true }) last_error: string | null;
    @Column({ type: "varchar", nullable: true }) lease_token: string | null;
    @Column({ type: "int8", nullable: true }) message_id: string | null;
}
