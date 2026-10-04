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

import { Column, Entity } from "typeorm";
import { BaseClass } from "./BaseClass";

// a staff announcement the official system account sent out from the admin panel
@Entity({
    name: "announcements",
})
export class Announcement extends BaseClass {
    // only announcements sent before they became plain messages have one
    @Column({ type: "character varying", nullable: true })
    title?: string | null;

    @Column({ type: "text" })
    body: string;

    @Column()
    audience: string; // "everyone" | "staff"

    @Column({ type: "int8", nullable: true })
    sent_by?: string | null;

    @Column({ type: "int", default: 0 })
    recipient_count: number = 0;

    @Column({ type: "int", default: 0 })
    attachment_count: number = 0;

    @Column({ type: "boolean", default: false })
    durable: boolean = false;

    @Column({ type: "timestamptz", default: () => "now()" })
    created_at: Date = new Date();
}
