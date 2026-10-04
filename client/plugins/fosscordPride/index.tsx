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

import definePlugin from "@utils/types";
import { FluxDispatcher, RestAPI, Text, UserProfileStore, UserStore, useEffect, useState } from "@webpack/common";

import { FosscordAuthor } from "../fosscordCore/shared";
import managedStyle from "./style.css?managed";

type Badge = { slug: string; id: string; description: string; icon: string };
type Selection = { flags: string[]; catalog: Badge[] };
const pending = new Map<string, { signature?: string; dirty: boolean; promise: Promise<void> }>();

function refreshProfile(id: string, signature?: string): Promise<void> {
    const running = pending.get(id);
    if (running) {
        if (signature === undefined || signature !== running.signature) {
            running.signature = signature ?? running.signature;
            running.dirty = true;
        }
        return running.promise;
    }
    if (pending.size >= 32) return Promise.reject(new Error("Profile refresh capacity reached."));
    const state = { signature, dirty: false, promise: Promise.resolve() };
    pending.set(id, state);
    state.promise = (async () => {
        try {
            do {
                state.dirty = false;
                try {
                    const { body } = await RestAPI.get({ url: `/users/${id}/profile` });
                    FluxDispatcher.dispatch({ type: "USER_PROFILE_FETCH_SUCCESS", userProfile: body });
                } catch (error) {
                    if (!state.dirty) throw error;
                }
            } while (state.dirty);
        } finally {
            pending.delete(id);
        }
    })();
    return state.promise;
}

function profileChanged(event: { user?: { id: string; pride_badges?: string[] }; updates?: { user?: { id: string; pride_badges?: string[] } }[] }) {
    for (const user of [event.user, ...(event.updates ?? []).map((update) => update.user)]) {
        if (user?.pride_badges !== undefined && UserProfileStore.getUserProfile(user.id)) refreshProfile(user.id, JSON.stringify(user.pride_badges)).catch(() => {});
    }
}

function PridePicker() {
    const [catalog, setCatalog] = useState<Badge[]>([]);
    const [flags, setFlags] = useState<string[]>([]);
    const [saved, setSaved] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    useEffect(() => {
        let active = true;
        RestAPI.get({ url: "/users/@me/pride-badges" })
            .then(({ body }: { body: Selection }) => {
                if (active) {
                    setCatalog(body.catalog);
                    setFlags(body.flags);
                    setSaved(body.flags);
                }
            })
            .catch(() => {
                if (active) setError("Could not load pride badges. Reopen Profiles to try again.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);
    const save = async (selection: string[]) => {
        setBusy(true);
        setError("");
        setMessage("");
        let persisted = false;
        try {
            const { body } = await RestAPI.patch({ url: "/users/@me/pride-badges", body: { flags: selection } });
            setFlags(body.flags);
            setSaved(body.flags);
            persisted = true;
            await refreshProfile(UserStore.getCurrentUser().id);
            setMessage(selection.length ? "Pride badges saved." : "Pride badges removed.");
        } catch {
            setError(persisted ? "Pride badges saved, but the preview could not refresh. Reopen your profile." : "Could not save pride badges. Try again.");
        } finally {
            setBusy(false);
        }
    };
    return (
        <section className="fosscord-pride" aria-label="Pride badges">
            <Text variant="text-md/semibold">Pride badges</Text>
            <Text variant="text-sm/normal" color="text-muted">
                Choose flags to show on your profile. Everyone who can view your profile can see them.
            </Text>
            {loading ? (
                <p role="status">Loading flags…</p>
            ) : (
                <>
                    <label className="fosscord-pride-search">
                        Search flags
                        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
                    </label>
                    <div className="fosscord-pride-grid">
                        {catalog
                            .filter((badge) => badge.description.toLowerCase().includes(query.trim().toLowerCase()))
                            .map((badge) => (
                                <label key={badge.slug} className="fosscord-pride-option">
                                    <input
                                        type="checkbox"
                                        checked={flags.includes(badge.slug)}
                                        disabled={busy}
                                        onChange={(event) => {
                                            setMessage("");
                                            setFlags(event.target.checked ? [...flags, badge.slug] : flags.filter((slug) => slug !== badge.slug));
                                        }}
                                    />
                                    <img
                                        src={`${location.protocol}//${(window as any).GLOBAL_ENV?.CDN_HOST || location.host}/badge-icons/${badge.icon}.png`}
                                        width="30"
                                        height="20"
                                        alt=""
                                    />
                                    <span>{badge.description}</span>
                                </label>
                            ))}
                    </div>
                    {!catalog.some((badge) => badge.description.toLowerCase().includes(query.trim().toLowerCase())) && <p>No flags match your search.</p>}
                    <div className="fosscord-pride-actions">
                        <button type="button" disabled={busy} onClick={() => save(flags)}>
                            {busy ? "Saving…" : "Save pride badges"}
                        </button>
                        <button type="button" disabled={busy || (!flags.length && !saved.length)} onClick={() => save([])}>
                            Remove all
                        </button>
                        <span>{flags.length} selected</span>
                    </div>
                </>
            )}
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
        </section>
    );
}

export default definePlugin({
    name: "FosscordPride",
    description: "Choose locally hosted pride flag badges in Profiles settings.",
    authors: [FosscordAuthor],
    required: true,
    managedStyle,
    renderPicker: () => <PridePicker />,
    flux: { USER_UPDATE: profileChanged, GUILD_MEMBER_UPDATE: profileChanged, PRESENCE_UPDATES: profileChanged },
    patches: [
        {
            find: "currentGlobalName:",
            replacement: { match: /(currentPronouns:\i\?\.pronouns\?\?""\},"pronouns"\),)/, replace: "$1$self.renderPicker()," },
        },
    ],
});
