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

import { In } from "typeorm";
import { Badge, User } from "@spacebar/database";
import { autoNitroBadge, badgeDirectory, ProfileBadge } from "@spacebar/util";
import { isSubscriptionBadge } from "./profile";

// the badge directory for a user; hidden badges are only listed for the user themselves
export async function userBadgeDirectory(userId: string, viewerId: string) {
    const user = await User.findOneOrFail({
        where: { id: userId },
        select: { id: true, badge_ids: true, badge_settings: true, premium: true, premium_since: true, created_at: true },
    });
    const badges: ProfileBadge[] = user.badge_ids?.length ? await Badge.find({ where: { id: In(user.badge_ids) } }) : [];
    const nitro = autoNitroBadge(user);
    if (nitro && !badges.some(isSubscriptionBadge)) {
        badges.unshift(nitro);
    }
    return badgeDirectory(badges, user.badge_settings, userId === viewerId);
}
