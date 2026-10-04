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

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Response } from "express";
import { Config } from "./Config";
import { ASSETS_FOLDER } from "./Constants";
import { DEFAULT_AVATAR_COLORS } from "./DefaultAvatars";

export const INSTANCE_ICON_PATH =
    "M2.5 9.5C2.5 7.5 3 4.5 4.2 3.2C4.8 2.6 5.6 2.7 6.1 3.2L8.6 5.8C10.8 5.3 13.2 5.3 15.4 5.8L17.9 3.2C18.4 2.7 19.2 2.6 19.8 3.2C21 4.5 21.5 7.5 21.5 9.5L21.5 13.5C21.5 18.2 17.5 20.8 12 20.8C6.5 20.8 2.5 18.2 2.5 13.5ZM6.5 13a1.9 2.5 0 1 0 3.8 0a1.9 2.5 0 1 0 -3.8 0ZM13.7 13a1.9 2.5 0 1 0 3.8 0a1.9 2.5 0 1 0 -3.8 0Z";
export const INSTANCE_WHISKERS_PATH =
    "M3.779 14.08L0.879 13.08A0.55 0.55 0 0 0 0.521 14.12L3.421 15.12A0.55 0.55 0 0 0 3.779 14.08ZM3.444 16.073L0.744 16.873A0.55 0.55 0 0 0 1.056 17.927L3.756 17.127A0.55 0.55 0 0 0 3.444 16.073ZM20.579 15.12L23.479 14.12A0.55 0.55 0 0 0 23.121 13.08L20.221 14.08A0.55 0.55 0 0 0 20.579 15.12ZM20.244 17.127L22.944 17.927A0.55 0.55 0 0 0 23.256 16.873L20.556 16.073A0.55 0.55 0 0 0 20.244 17.127Z";
export const DEFAULT_FAVICON_FILE = path.join(ASSETS_FOLDER, "public", "branding", "favicon.svg");

export const DEFAULT_ICON_FILE = path.join(ASSETS_FOLDER, "icon.png");

export type BrandImage = { url: string } | { file: string };

export const resolveBrandImage = (value?: string | null): BrandImage | null => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return { url: trimmed };
    const file = path.resolve(ASSETS_FOLDER, "..", trimmed);
    return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? { file } : null;
};

export const instanceIcon = () => resolveBrandImage(Config.get().client.icon) ?? resolveBrandImage(Config.get().general.image);

export const instanceLogo = () => resolveBrandImage(Config.get().client.logo);

export const instanceName = () => Config.get().client.instanceName || Config.get().general.instanceName || "Fosscord";

export const helpUrl = () => {
    const url = Config.get().client.helpUrl?.trim();
    return url && /^https?:\/\//i.test(url) ? url : null;
};

const version = (image: BrandImage) => createHash("sha1").update(JSON.stringify(image)).digest("hex").slice(0, 8);

export const brandImageUrls = () => {
    const icon = instanceIcon();
    const logo = instanceLogo();
    return {
        icon: icon ? `/static/logo.png?v=${version(icon)}` : null,
        logo: logo ? `/static/wordmark?v=${version(logo)}` : null,
    };
};

export const BRAND_COLOR = "#7B5CFF";

export const instanceIconTile = () => {
    const { icon } = brandImageUrls();
    if (icon) return `<img class="brand-icon" src="${escapeXml(icon)}" alt="" />`;
    return `<svg class="brand-icon" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="15" fill="${BRAND_COLOR}"/><g transform="translate(6 6) scale(1.5)" fill="#fff"><path fill-rule="evenodd" d="${INSTANCE_ICON_PATH}"/><path d="${INSTANCE_WHISKERS_PATH}"/></g></svg>`;
};

export const brandPage = (html: string) => html.replaceAll("__INSTANCE_NAME__", escapeXml(instanceName())).replaceAll("__INSTANCE_ICON__", instanceIconTile());

export const sendBrandImage = (res: Response, image: BrandImage, cacheControl = "public, max-age=21600") => {
    res.set("Cache-Control", cacheControl);
    if ("url" in image) return res.redirect(302, image.url);
    return res.sendFile(image.file, { cacheControl: false, dotfiles: "allow" });
};

const remoteIcons = new Map<string, Promise<string | null>>();

const MIME_TYPES: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
};

const fetchDataUri = async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    const type = res?.headers.get("content-type")?.split(";")[0];
    if (!res?.ok || !type?.startsWith("image/")) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
};

export const instanceIconDataUri = async () => {
    const icon = instanceIcon();
    if (!icon) return null;
    if ("file" in icon) {
        const data = await fs.promises.readFile(icon.file).catch(() => null);
        return data ? `data:${MIME_TYPES[path.extname(icon.file).toLowerCase()] ?? "image/png"};base64,${data.toString("base64")}` : null;
    }
    if (!remoteIcons.has(icon.url)) {
        const pending = fetchDataUri(icon.url);
        remoteIcons.set(icon.url, pending);
        void pending.then((uri) => uri ?? remoteIcons.delete(icon.url));
    }
    return remoteIcons.get(icon.url) ?? null;
};

const escapeXml = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

const iconMarkup = (x: number, y: number, size: number, iconUri: string | null) =>
    iconUri
        ? `<image href="${escapeXml(iconUri)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
        : `<g fill="#fff" transform="translate(${x} ${y}) scale(${size / 24})"><path fill-rule="evenodd" d="${INSTANCE_ICON_PATH}"/><path d="${INSTANCE_WHISKERS_PATH}"/></g>`;

export const wordmarkSvg = (box?: [number, number], iconUri: string | null = null) => {
    const name = instanceName();
    const width = Math.ceil(34 + [...name].length * 12.5);
    const [boxWidth, boxHeight] = box ?? [width, 24];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${width} 24" fill="none">${iconMarkup(0, 0, 24, iconUri)}<text x="32" y="19.5" fill="#fff" font-family="'gg sans','Noto Sans','Helvetica Neue',Helvetica,Arial,sans-serif" font-size="20" font-weight="800">${escapeXml(name)}</text></svg>`;
};

export const qrLogoSvg = (iconUri: string | null = null) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#000"/>${iconMarkup(23, 23, 54, iconUri)}</svg>`;

export const placeholderAvatarSvg = (size: number, background: string, foreground: string, iconUri: string | null = null) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256"><circle cx="128" cy="128" r="128" fill="${background}"/>${
        iconUri
            ? `<image href="${escapeXml(iconUri)}" x="62" y="62" width="132" height="132" preserveAspectRatio="xMidYMid meet" opacity="0.6"/>`
            : `<g fill="${foreground}" transform="translate(62 62) scale(5.5)"><path fill-rule="evenodd" d="${INSTANCE_ICON_PATH}"/><path d="${INSTANCE_WHISKERS_PATH}"/></g>`
    }</svg>`;

export const APP_THEME_COLOR = "#121214";

const appIcons = new Map<string, Promise<Buffer | null>>();

const renderAppIcon = async (image: BrandImage, size: number) => {
    const { Jimp } = await import("jimp");
    const source =
        "file" in image ? image.file : await fetch(image.url, { signal: AbortSignal.timeout(5000) }).then(async (res) => (res.ok ? Buffer.from(await res.arrayBuffer()) : null));
    if (!source) return null;
    const icon = await Jimp.read(source);
    if ("file" in image && image.file === DEFAULT_ICON_FILE) return icon.resize({ w: size, h: size }).getBuffer("image/png");
    const inner = Math.round(size * 0.62);
    icon.scaleToFit({ w: inner, h: inner });
    const canvas = new Jimp({ width: size, height: size, color: parseInt(`${APP_THEME_COLOR.slice(1)}ff`, 16) });
    canvas.composite(icon, Math.round((size - icon.bitmap.width) / 2), Math.round((size - icon.bitmap.height) / 2));
    return canvas.getBuffer("image/png");
};

export const appIconPng = (size: number) => {
    const image = instanceIcon() ?? { file: DEFAULT_ICON_FILE };
    const key = `${version(image)}:${size}`;
    let pending = appIcons.get(key);
    if (!pending) {
        if (appIcons.size > 16) appIcons.clear();
        pending = renderAppIcon(image, size).catch(() => null);
        appIcons.set(key, pending);
        void pending.then((png) => png ?? appIcons.delete(key));
    }
    return pending.then((png) => png ?? renderAppIcon({ file: DEFAULT_ICON_FILE }, size).catch(() => null));
};

export const appIconUrl = (size: number) => `/assets/pwa/icon-${size}.png?v=${version(instanceIcon() ?? { file: DEFAULT_ICON_FILE })}`;

export const appManifest = () => {
    const name = instanceName();
    return {
        id: "/app",
        name,
        short_name: name,
        start_url: "/app",
        scope: "/",
        display: "standalone",
        background_color: APP_THEME_COLOR,
        theme_color: APP_THEME_COLOR,
        icons: [192, 512].flatMap((size) => ["any", "maskable"].map((purpose) => ({ src: appIconUrl(size), sizes: `${size}x${size}`, type: "image/png", purpose }))),
    };
};

export const defaultAvatarSvg = (index: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${DEFAULT_AVATAR_COLORS[index % DEFAULT_AVATAR_COLORS.length]}"/><g fill="#fff" transform="translate(53 54) scale(6.25)"><path fill-rule="evenodd" d="${INSTANCE_ICON_PATH}"/><path d="${INSTANCE_WHISKERS_PATH}"/></g></svg>`;
