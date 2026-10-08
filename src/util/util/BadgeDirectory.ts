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

import { Config } from "./Config";

// The client's badge management (experiment 2026-08-badge-management) only knows Discord's own badges: it maps a profile
// badge's string id to a numeric badge id (staff -> 22) and back. Instance badges carrying Discord's artwork are matched
// by icon hash so they are reported under Discord's id and can be hidden and reordered; other badges are left as they are.
const DISCORD_BADGES: Record<string, { key: string; badge_id: number }> = {
    "2ba85e8026a8614b640c2837bcdfe21b": { key: "premium", badge_id: 1 },
    premium_tenure_1_month_v2: { key: "premium_tenure_1_month_v2", badge_id: 1 },
    premium_tenure_3_month_v2: { key: "premium_tenure_3_month_v2", badge_id: 1 },
    premium_tenure_6_month_v2: { key: "premium_tenure_6_month_v2", badge_id: 1 },
    premium_tenure_12_month_v2: { key: "premium_tenure_12_month_v2", badge_id: 1 },
    premium_tenure_24_month_v2: { key: "premium_tenure_24_month_v2", badge_id: 1 },
    premium_tenure_36_month_v2: { key: "premium_tenure_36_month_v2", badge_id: 1 },
    premium_tenure_60_month_v2: { key: "premium_tenure_60_month_v2", badge_id: 1 },
    premium_tenure_72_month_v2: { key: "premium_tenure_72_month_v2", badge_id: 1 },
    "5e74e9b61934fc1f67c65515d1f7e60d": { key: "staff", badge_id: 22 },
    "3f9748e53446a137a052f3454e2de41e": { key: "partner", badge_id: 2 },
    fee1624003e2fee35cb398e125dc479b: { key: "certified_moderator", badge_id: 3 },
    bf01d1073931f921909045f3a39fd264: { key: "hypesquad", badge_id: 4 },
    "8a88d63823d8a71cd5e390baa45efa02": { key: "hypesquad_house_1", badge_id: 5 },
    "011940fd013da3f7fb926e4a1cd2e618": { key: "hypesquad_house_2", badge_id: 6 },
    "3aa41de486fa12454c3761e8e223442e": { key: "hypesquad_house_3", badge_id: 7 },
    "2717692c7dca7289b35297368a940dd0": { key: "bug_hunter_level_1", badge_id: 8 },
    "848f79194d4be5ff5f81505cbd0ce1e6": { key: "bug_hunter_level_2", badge_id: 9 },
    "6df5892e0f35b051f8b61eace34f4967": { key: "verified_developer", badge_id: 10 },
    "7060786766c9c840eb3019e725d2b358": { key: "early_supporter", badge_id: 11 },
    "7d9ae358c8c5e118768335dbe68b4fb8": { key: "quest_completed", badge_id: 14 },
    "83d8a1eb09a8d64e59233eec5d4d5c2d": { key: "orb_profile_badge", badge_id: 16 },
    // Active Developer has no id of its own in the client; it borrows Game Variety, which has no other use here and
    // only changes how tiers show in the badge directory (this server sends none)
    "6bdc42827a38498929a4920da12695d9": { key: "game_variety", badge_id: 21 },
};

// the client badge management allows customizing badges
export const FIXED_BADGE_IDS = new Set<number>();

export function autoNitroBadge(user: { premium?: boolean; premium_since?: Date | null; created_at?: Date | null }): ProfileBadge | null {
    if (user.premium === false) return null;
    const since = user.premium_since ?? user.created_at ?? new Date();
    const date = new Date(since);
    const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    return {
        id: "premium_tenure_72_month_v2",
        description: `Subscriber since ${dateStr}`,
        icon: "premium_tenure_72_month_v2",
        link: "https://discord.com/settings/premium",
    };
}

export type BadgeSettings = { hidden_badges: number[]; display_order: number[] };
export type ProfileBadge = { id: string; description: string; icon: string; link?: string | null };

export function discordBadgeFor(icon: string) {
    return DISCORD_BADGES[icon];
}

// profile badges as the client expects them: Discord's string id where there is one, hidden badges dropped and the rest
// fixed badges first, then the user's order, then the rest in their original order
export function arrangeProfileBadges<T extends ProfileBadge>(badges: T[], settings?: BadgeSettings | null): T[] {
    const hidden = new Set(settings?.hidden_badges ?? []);
    const order = settings?.display_order ?? [];
    const rank = (badge: T, position: number) => {
        const known = discordBadgeFor(badge.icon);
        if (known && FIXED_BADGE_IDS.has(known.badge_id)) return -1;
        const index = known ? order.indexOf(known.badge_id) : -1;
        return index === -1 ? order.length + position : index;
    };
    return badges
        .filter((badge) => {
            const known = discordBadgeFor(badge.icon);
            return !known || FIXED_BADGE_IDS.has(known.badge_id) || !hidden.has(known.badge_id);
        })
        .map((badge, position) => ({ badge, position, rank: rank(badge, position) }))
        .sort((a, b) => a.rank - b.rank || a.position - b.position)
        .map(({ badge }) => {
            const known = discordBadgeFor(badge.icon);
            return known ? { ...badge, id: known.key } : badge;
        });
}

// the badge directory entries (GET /users/:id/badges) for the badges a user holds that the client can manage
export function badgeDirectory(badges: ProfileBadge[], settings: BadgeSettings | null | undefined, includeHidden: boolean) {
    const hidden = new Set(settings?.hidden_badges ?? []);
    const cdn = (Config.get().cdn.endpointPublic ?? "").replace(/\/$/, "");
    return badges.flatMap((badge) => {
        const known = discordBadgeFor(badge.icon);
        if (!known) return [];
        const isHidden = !FIXED_BADGE_IDS.has(known.badge_id) && hidden.has(known.badge_id);
        if (isHidden && !includeHidden) return [];
        return [
            {
                badge_id: known.badge_id,
                name: known.badge_id === 1 ? "Discord Nitro" : badge.description,
                description: badge.description,
                owned: true,
                hidden: isHidden,
                simple_icon_url: `${cdn}/badge-icons/${badge.icon}.png`,
                simple_icon_raster_url: `${cdn}/badge-icons/${badge.icon}.png`,
                link: badge.link ?? null,
                tiers: [],
                current_tier: null,
                next_tier: null,
                progress: [],
                is_earnable: false,
                leveling_instructions: null,
            },
        ];
    });
}

// a settings update from the client, limited to badge ids the client knows and that may be hidden
export function sanitizeBadgeSettings(body: { display_order?: unknown; hidden_badges?: unknown }, current?: BadgeSettings | null): BadgeSettings {
    const known = new Set(Object.values(DISCORD_BADGES).map((badge) => badge.badge_id));
    const ids = (value: unknown, fallback: number[]) =>
        Array.isArray(value) ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && known.has(id)))].slice(0, 64) : fallback;
    return {
        display_order: ids(body.display_order, current?.display_order ?? []),
        hidden_badges: ids(body.hidden_badges, current?.hidden_badges ?? []).filter((id) => !FIXED_BADGE_IDS.has(id)),
    };
}
