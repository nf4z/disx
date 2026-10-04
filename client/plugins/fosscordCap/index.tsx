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

import definePlugin, { StartAt } from "@utils/types";
import { React, RestAPI, useEffect, useRef, useState } from "@webpack/common";

import { FosscordAuthor } from "../fosscordCore/shared";
import managedStyle from "./style.css?managed";

type CapConfiguration = { service?: string; endpoint?: string; register?: boolean };
type CapElement = HTMLElement & { reset(): void };
type CapController = { takeToken(): string | undefined; rejectToken(): void };
let current: CapController | undefined;
let widgetLoader: Promise<void> | undefined;

function loadWidget(): Promise<void> {
    if (customElements.get("cap-widget")) return Promise.resolve();
    if (widgetLoader) return widgetLoader;
    const globals = window as typeof window & Record<string, unknown>;
    globals.CAP_CUSTOM_WASM_URL = "/api/v9/auth/cap/cap_wasm_bg.wasm";
    globals.CAP_CUSTOM_HASHWX_URL = "/api/v9/auth/cap/hashwx.wasm";
    globals.CAP_PAKO_URL = "/api/v9/auth/cap/pako.js";
    globals.CAP_DISABLE_WIDGET_REF = true;
    widgetLoader = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/api/v9/auth/cap/widget.js";
        script.onload = () => customElements.whenDefined("cap-widget").then(() => resolve());
        script.onerror = () => {
            script.remove();
            widgetLoader = undefined;
            reject(new Error("Could not load verification."));
        };
        document.head.append(script);
    });
    return widgetLoader;
}

function SignupVerification() {
    const container = useRef<HTMLDivElement>(null);
    const [enabled, setEnabled] = useState(true);
    const [message, setMessage] = useState("Loading account verification…");
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        let token: string | undefined;
        let required = true;
        let ready = false;
        let widget: CapElement | undefined;
        const form = container.current?.closest("form");
        const controller: CapController = {
            takeToken() {
                return token;
            },
            rejectToken() {
                token = undefined;
                widget?.reset();
                setError("Verification expired or was already used. Verify again, then create your account.");
            },
        };
        current = controller;
        const onSubmit = (event: Event) => {
            if (!required || (ready && token)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setError(ready ? "Complete the verification before creating your account." : "Account verification is not ready. Wait or retry verification.");
            widget?.setAttribute("aria-invalid", "true");
            const button = widget?.shadowRoot?.querySelector<HTMLElement>("button, [role=button], [role=checkbox], input");
            if (button) button.focus();
            else container.current?.focus();
        };
        form?.addEventListener("submit", onSubmit, true);
        RestAPI.get({ url: "/auth/captcha" })
            .then(async ({ body }: { body: CapConfiguration }) => {
                if (!active) return;
                required = body.register === true && body.service === "cap";
                setEnabled(required);
                if (!required) return;
                if (!body.endpoint) throw new Error("Verification endpoint is unavailable.");
                await loadWidget();
                if (!active || !container.current) return;
                widget = document.createElement("cap-widget") as CapElement;
                widget.setAttribute("data-cap-api-endpoint", body.endpoint);
                widget.setAttribute("required", "");
                widget.setAttribute("aria-label", "Required account verification");
                widget.setAttribute("aria-describedby", "fosscord-cap-status fosscord-cap-error");
                widget.setAttribute("data-cap-disable-haptics", "");
                widget.setAttribute("data-cap-worker-count", String(Math.max(1, Math.min(navigator.hardwareConcurrency || 2, matchMedia("(pointer: coarse)").matches ? 2 : 4))));
                widget.addEventListener("solve", (event) => {
                    token = (event as CustomEvent<{ token: string }>).detail.token;
                    widget?.removeAttribute("aria-invalid");
                    setError("");
                    setMessage("Verified. You can create your account.");
                });
                widget.addEventListener("reset", () => {
                    token = undefined;
                    widget?.shadowRoot?.querySelector('[part="trigger"]')?.setAttribute("aria-label", "Click to verify you're a human");
                    setMessage("Complete this verification to create your account.");
                });
                widget.addEventListener("error", () => {
                    token = undefined;
                    setError("Verification failed. Try the verification again.");
                });
                container.current.append(widget);
                ready = true;
                setMessage("Complete this verification to create your account.");
            })
            .catch(() => {
                if (active) {
                    setMessage("");
                    setError("Could not load account verification. Retry verification to continue.");
                }
            });
        return () => {
            active = false;
            form?.removeEventListener("submit", onSubmit, true);
            widget?.remove();
            if (current === controller) current = undefined;
        };
    }, [attempt]);
    if (!enabled) return null;
    return (
        <section className="fosscord-cap-verification" aria-label="Account verification">
            <div className="fosscord-cap-label">
                Account verification <span>Required</span>
            </div>
            <div ref={container} tabIndex={-1} className="fosscord-cap-container" />
            <p id="fosscord-cap-status" role="status">
                {message}
            </p>
            {error && (
                <p id="fosscord-cap-error" role="alert">
                    {error}
                </p>
            )}
            {error && (
                <button
                    type="button"
                    onClick={() => {
                        setError("");
                        setMessage("Loading account verification…");
                        setAttempt(attempt + 1);
                    }}
                >
                    Retry verification
                </button>
            )}
        </section>
    );
}

export default definePlugin({
    name: "FosscordCap",
    description: "Require a visible, self-hosted Cap verification before creating an account.",
    authors: [FosscordAuthor],
    required: true,
    startAt: StartAt.DOMContentLoaded,
    managedStyle,
    withWidget: (consent: React.ReactNode) => (
        <>
            <SignupVerification />
            {consent}
        </>
    ),
    takeToken: () => current?.takeToken(),
    handleChallenge(body: { captcha_service?: string } | undefined) {
        if (body?.captcha_service !== "cap" || !current) return false;
        current.rejectToken();
        return true;
    },
    patches: [
        {
            find: "interceptResponse(",
            replacement: {
                match: /interceptResponse\((\i),(\i),(\i)\)\{/,
                replace: "$&if($self.handleChallenge($1.body))return!1;",
            },
        },
        {
            find: "REGISTER_PROMO_EMAIL_CHECKBOX_WEB",
            replacement: [
                {
                    match: /function (\i)\((\i)\)\{let\{consent:(\i),consentRequired:(\i),onConsentChange:(\i)\}=\2;/,
                    replace: "function $1($2){return $self.withWidget($1CapConsent($2))}function $1CapConsent($2){let{consent:$3,consentRequired:$4,onConsentChange:$5}=$2;",
                },
                {
                    match: /(url:\i\.\i\.REGISTER,body:\{)/,
                    replace: "$1captcha_key:$self.takeToken(),",
                },
            ],
        },
    ],
});
