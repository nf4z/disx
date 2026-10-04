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

import { Request } from "express";
import { AuditLog, User } from "@spacebar/database";
import { Rights } from "@spacebar/util";
import { HTTPError } from "lambert-server/HTTPError";
import { AuditLogEvents } from "@spacebar/schemas";
import { EntityManager } from "typeorm";

export const ADMIN_USER_CUSTOMIZATION_ACTION = AuditLogEvents.ADMIN_USER_CUSTOMIZATION;
export async function adminCustomizationTarget(req: Request) {
    const user = await User.findOneOrFail({ where: { id: req.params.user_id as string }, select: { id: true, rights: true, bot: true } });
    if (new Rights(user.rights).has("OPERATOR") && !req.rights.has("OPERATOR") && user.id !== req.user_id) throw new HTTPError("Only operators can edit other operators", 403);
    return user;
}
export async function recordAdminCustomization(req: Request, target_id: string, section: string, fields: string[], manager?: EntityManager) {
    const reason = req.headers["x-audit-log-reason"];
    const entry = AuditLog.create({
        user_id: req.user_id,
        target_id,
        action_type: ADMIN_USER_CUSTOMIZATION_ACTION,
        options: { type: section },
        changes: AuditLog.diff({}, { fields }, ["fields"]),
        reason: typeof reason === "string" ? reason.slice(0, 512) : undefined,
    });
    return manager ? manager.save(entry) : entry.save();
}
