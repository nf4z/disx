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

const TAG = 8;
const SELECT = 5;
const PLURAL = 6;

// larpcord too: client files downloaded before branding moved into this plugin already had Discord rewritten to LarpCord
const CANDIDATE = /discord|discrod|larpcord|nitr|premium|ディスコード|ไนโตร/i;

const brandText = (text: string, name: string) => {
    if (!CANDIDATE.test(text)) return text;
    const host = location.host;
    return text
        .replace(/https?:\/\/discord\.gg\//g, () => `${location.origin}/invite/`)
        .replace(/(?<![\w@.-])discord\.gg\//g, () => `${host}/invite/`)
        .replace(/https?:\/\/(?:www\.)?discord\.com(?![\w.-])/g, () => location.origin)
        .replace(/(?<![\w@./-])discord\.com(?![\w.-])/g, () => host)
        .replace(/DISCORD/g, (match) => (/741741/.test(text) ? match : name.toUpperCase()))
        .replace(/LARPCORD/g, () => name.toUpperCase())
        .replace(/Discord|Discrod|LarpCord|ディスコード/g, () => name)
        .replace(/(?<![\p{L}\w.@/-])discord(?![\p{L}\w.@/-])/gu, () => name)
        .replace(/(?:NITRO|PREMIUM)(?: BASIC| CLASSIC)?/g, "FEATURES")
        .replace(/ไนโตร/g, "Features")
        .replace(/Nitro(['’])(\p{Script=Latin}+)/gu, "Features")
        .replace(/Nitr([oóо])(\p{Script=Latin}*)/gu, "Features")
        .replace(/Nitr(?:a|u+|em|om|e|y|ou)(?!\p{Script=Latin})/gu, "Features")
        .replace(/\bPremium(?: Basic| Classic)?\b/gi, "Features");
};

const QR_LOGIN = /^\["Scan this with the ",\[8,"\$b",\["[^"]*"\]\]," to log in instantly\."\]$/;

const QR_LABEL = JSON.stringify(["QR code to log in with the Discord mobile app"]);

const brandList = (list: unknown[], name: string): unknown[] =>
    list.map((node) => (typeof node === "string" ? brandText(node, name) : Array.isArray(node) ? brandNode(node, name) : node));

const brandOptions = (options: Record<string, unknown>, name: string) =>
    Object.fromEntries(Object.entries(options).map(([key, value]) => [key, Array.isArray(value) ? brandList(value, name) : value]));

const brandNode = (node: unknown[], name: string): unknown[] => {
    const [type] = node;
    if (type === TAG && Array.isArray(node[2])) return [...node.slice(0, 2), brandList(node[2], name), ...node.slice(3)];
    if ((type === SELECT || type === PLURAL) && node[2] && typeof node[2] === "object")
        return [...node.slice(0, 2), brandOptions(node[2] as Record<string, unknown>, name), ...node.slice(3)];
    return node;
};

export const brandMessages = (messages: Record<string, unknown>) => {
    if (!messages || typeof messages !== "object" || Array.isArray(messages)) return messages;
    const name = String((window as any).GLOBAL_ENV?.INSTANCE_NAME || "LarpCord");
    const qrLabel = JSON.stringify(messages["SzYj9v"]);
    for (const key in messages) {
        const value = messages[key];
        if (typeof value === "string") messages[key] = brandText(value, name);
        else if (Array.isArray(value)) messages[key] = brandList(value, name);
    }
    const qr = messages["Qq+A6i"];
    if (Array.isArray(qr) && QR_LOGIN.test(JSON.stringify(qr)))
        messages["Qq+A6i"] = ["Scan this with ", [8, "$b", ["your phone's camera"]], ", then approve the login on your phone."];
    if (qrLabel === QR_LABEL) messages["SzYj9v"] = ["QR code to log in with your phone's camera"];
    return messages;
};
