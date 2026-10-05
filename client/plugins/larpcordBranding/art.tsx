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

import { React } from "@webpack/common";

// Discord's own logo (the Home button glyph from the client)
export const MEOWCORD_HEAD =
    "M19.73 4.87a18.2 18.2 0 0 0-4.6-1.44c-.21.4-.4.8-.58 1.21-1.69-.25-3.4-.25-5.1 0-.18-.41-.37-.82-.59-1.2-1.6.27-3.14.75-4.6 1.43A19.04 19.04 0 0 0 .96 17.7a18.43 18.43 0 0 0 5.63 2.87c.46-.62.86-1.28 1.2-1.98-.65-.25-1.29-.55-1.9-.92.17-.12.32-.24.47-.37 3.58 1.7 7.7 1.7 11.28 0l.46.37c-.6.36-1.25.67-1.9.92.35.7.75 1.35 1.2 1.98 2.03-.63 3.94-1.6 5.64-2.87.47-4.87-.78-9.09-3.3-12.83ZM8.3 15.12c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.89 2.27-2 2.27Zm7.4 0c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.88 2.27-2 2.27Z";
export const MEOWCORD_LEFT = "";
export const MEOWCORD_RIGHT = "";
export const MEOWCORD_SPINNER_CSS =
    "@keyframes meowcord-spinner-flip{0%{transform:perspective(500px) translateY(0) rotateY(0) scale(1)}18%{transform:perspective(500px) translateY(2px) rotateY(0) scale(1.12,.86)}50%{transform:perspective(500px) translateY(-18px) rotateY(180deg) scale(.96,1.06)}78%{transform:perspective(500px) translateY(0) rotateY(360deg) scale(1.1,.9)}90%,100%{transform:perspective(500px) translateY(0) rotateY(360deg) scale(1)}}@keyframes meowcord-spinner-flare-l{0%,22%,80%,100%{transform:rotate(0)}50%{transform:rotate(-28deg)}}@keyframes meowcord-spinner-flare-r{0%,22%,80%,100%{transform:rotate(0)}50%{transform:rotate(28deg)}}.meowcord-spinner>svg{overflow:visible;animation:meowcord-spinner-flip 1.1s cubic-bezier(.5,0,.3,1) infinite;transform-origin:50% 75%}.meowcord-spinner .wl,.meowcord-spinner .wr{transform-box:fill-box}.meowcord-spinner .wl{transform-origin:100% 50%;animation:meowcord-spinner-flare-l 1.1s ease-in-out infinite}.meowcord-spinner .wr{transform-origin:0% 50%;animation:meowcord-spinner-flare-r 1.1s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.meowcord-spinner>svg,.meowcord-spinner .wl,.meowcord-spinner .wr{animation:none}}";

export const MeowcordPaths = ({ fill = "currentColor", className }: { fill?: string; className?: string }) => (
    <g className={className} fill={fill}>
        <path fillRule="evenodd" d={MEOWCORD_HEAD} />
        <path d={MEOWCORD_LEFT + MEOWCORD_RIGHT} />
    </g>
);

export function MeowcordSpinner({ className, onReady, setRef }: { className?: string; onReady?: () => void; setRef?: (element: HTMLElement | null) => void }) {
    React.useEffect(() => void onReady?.(), []);
    return (
        <div
            ref={setRef}
            className={`meowcord-spinner ${className ?? ""}`}
            role="progressbar"
            aria-label="Loading"
            data-testid="app-spinner"
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 200,
                height: 200,
                margin: "0 auto",
                color: "var(--text-strong,var(--header-primary,black))",
            }}
        >
            <style>{MEOWCORD_SPINNER_CSS}</style>
            <svg width="80" height="80" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" fillRule="evenodd" d={MEOWCORD_HEAD} />
                <path className="wl" fill="currentColor" d={MEOWCORD_LEFT} />
                <path className="wr" fill="currentColor" d={MEOWCORD_RIGHT} />
            </svg>
        </div>
    );
}
