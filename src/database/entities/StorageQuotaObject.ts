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

import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "storage_quota_objects" })
export class StorageQuotaObject extends BaseEntity {
    @PrimaryColumn() namespace: string;
    @PrimaryColumn() path: string;
    @Column() principal: string;
    @Column() category: string;
    @Column({ type: "bigint", default: "0" }) bytes: string;
    @Column() generation: string;
    @Column({ nullable: true }) pending_operation: string;
    @Column({ default: "reserved" }) state: string;
}
