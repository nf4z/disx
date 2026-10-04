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
import { Application } from "./Application";
import { User } from "./User";

// What an application knows about a user, shown in that application's profile widget.
@Entity({ name: "application_identities" })
export class ApplicationIdentity extends BaseClassWithoutId {
    @PrimaryColumn({ type: "int8" })
    application_id: string;

    @JoinColumn({ name: "application_id", foreignKeyConstraintName: "FK_application_identity_application_id" })
    @ManyToOne(() => Application, { onDelete: "CASCADE" })
    application: Application;

    @PrimaryColumn({ type: "int8" })
    @Index("IDX_application_identities_user_id")
    user_id: string;

    @JoinColumn({ name: "user_id", foreignKeyConstraintName: "FK_application_identity_user_id" })
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    user: User;

    @Column({ type: "varchar", nullable: true })
    username?: string | null;

    @Column({ type: "jsonb", default: {} })
    data: Record<string, string | number>;

    @Column({ type: "timestamp with time zone", default: () => "now()" })
    updated_at: Date;
}
