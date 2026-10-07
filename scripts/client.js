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

const path = require("path");
const https = require("node:https");
const vm = require("vm");
const fs = require("fs/promises");
const { existsSync } = require("fs");

const BASE_URL = (process.env.CLIENT_BASE_URL || "https://canary.discord.com").replace(/\/$/, "");
const CLIENT_HOSTS = [...new Set([BASE_URL, ...(process.env.CLIENT_FALLBACK_URLS || "https://canary.discord.com,https://ptb.discord.com,https://discord.com").split(",").map((url) => url.trim().replace(/\/$/, "")).filter(Boolean)])];
const CACHE_PATH = path.resolve(process.env.CLIENT_CACHE_PATH || path.join(__dirname, "..", "assets", "cache"));
const CONCURRENCY = Math.max(1, Math.min(32, Math.floor(Number(process.env.CLIENT_CONCURRENCY) || 8)));
const USER_AGENT = process.env.CLIENT_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const MAX_RETRIES = Math.max(1, Math.min(8, Math.floor(Number(process.env.CLIENT_RETRIES) || 5)));
const RETRY_DELAY = Math.max(250, Math.min(10000, Math.floor(Number(process.env.CLIENT_RETRY_DELAY) || 1000)));

const MEDIA_EXT = "svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp3|ogg|wav|mp4|webm|json|lottie|wasm";
const ASSET_NAME = new RegExp(`(?:^|["'(/\\s])((?:[\\w-]+\\.)?[0-9a-f]{8,32}\\.(?:js|css|${MEDIA_EXT}))(?=["')?#\\s]|$)`, "g");
const TEXT_EXT = /\.(js|css|json)$/;

const patch = (content) =>
    content
        .replaceAll("delete window.localStorage", "void 0")
        .replaceAll("`https://discord.com/ra/${", "`${location.origin}/ra/${")
        .replaceAll('"https:"+window.GLOBAL_ENV', " location.protocol+window.GLOBAL_ENV")
        .replaceAll("returnlocation.protocol", "return location.protocol")
        .replaceAll("`https:${window.GLOBAL_ENV", "`${location.protocol}${window.GLOBAL_ENV")
        .replaceAll("`https://${", "`${location.protocol}//${");

const sliceExpression = (source, start) => {
    const closers = { "(": ")", "[": "]", "{": "}" };
    const stack = [];
    let quote = null;
    for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") quote = ch;
        else if (closers[ch]) stack.push(closers[ch]);
        else if (ch === ")" || ch === "]" || ch === "}") {
            if (!stack.length) return source.slice(start, i);
            stack.pop();
        } else if ((ch === "," || ch === ";") && !stack.length) return source.slice(start, i);
    }
    return source.slice(start);
};

const chunkNames = (source) => {
    const names = new Set();
    for (const match of source.matchAll(/\.[uk]=([a-zA-Z_$][\w$]*)=>/g)) {
        const parameter = match[1];
        const body = sliceExpression(source, match.index + match[0].length);
        const ids = new Set([...body.matchAll(/"(\d+)"===[a-zA-Z_$][\w$]*/g), ...body.matchAll(/[{,](\d+(?:e\d+)?):"[0-9a-f]+"/g)].map((m) => String(Number(m[1]))));
        let fn;
        try {
            fn = vm.runInNewContext(`(${parameter}=>${body})`, {}, { timeout: 100 });
        } catch {
            continue;
        }
        for (const id of ids) {
            const name = fn(id);
            if (typeof name === "string" && /^[\w.-]+$/.test(name) && !name.includes("undefined")) names.add(name);
        }
    }
    return names;
};

const WASM_MODULE = /\.v\(\w+,\w+\.id,"([0-9a-f]{8,32})"/g;
const references = (text) => {
    const names = [...text.matchAll(ASSET_NAME)]
        .filter((match) => {
            const prefix = text.slice(Math.max(0, match.index - 512), match.index + 1);
            const url = prefix.match(/https?:\/\/[^\s"'`]*$/)?.[0];
            return !url || /\/assets\/$/.test(url);
        })
        .map((match) => match[1]);
    return new Set([...names, ...[...text.matchAll(WASM_MODULE)].map((match) => `${match[1]}.module.wasm`)]);
};
const checkOnly = process.argv.includes("--check");
const indexOnly = process.argv.includes("--index-only");
const onlyMissing = checkOnly || process.argv.includes("--missing");
const writeAtomic = async (file, body) => {
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, body);
    await fs.rename(temporary, file);
};

const browserHeaders = (referer) => ({
    "user-agent": USER_AGENT,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "upgrade-insecure-requests": "1",
    "sec-fetch-site": referer ? "same-origin" : "none",
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
    "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    ...(referer ? { referer } : {}),
});

const cookieHeader = (cookies) => Array.from(cookies.entries()).map(([key, value]) => key + "=" + value).join("; ");

const captureCookies = (response, cookies) => {
    const setCookies = typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/);
    for (const header of setCookies) {
        const pair = header.split(";", 1)[0];
        const index = pair.indexOf("=");
        if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
};

const nativeHttpsGet = (url, headers = {}, redirects = 0) => new Promise((resolve, reject) => {
    const request = https.get(url, {
        headers: {
            ...headers,
            "accept-encoding": "identity",
            connection: "close",
        },
    }, (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        if (location && status >= 300 && status < 400 && redirects < 5) {
            response.resume();
            nativeHttpsGet(new URL(location, url).toString(), headers, redirects + 1).then(resolve, reject);
            return;
        }
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => resolve({
            status,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
        }));
    });
    request.on("error", reject);
    request.setTimeout(30000, () => request.destroy(new Error("HTTPS request timed out")));
});

const fetchAppPage = async () => {
    const cookies = new Map();
    let lastError;
    for (const baseUrl of CLIENT_HOSTS) {
        try {
            const root = await fetch(baseUrl + "/", {
                headers: browserHeaders(),
                redirect: "follow",
                signal: AbortSignal.timeout(30000),
            });
            captureCookies(root, cookies);
            await root.body?.cancel();

            const headers = browserHeaders(baseUrl + "/");
            const cookie = cookieHeader(cookies);
            if (cookie) headers.cookie = cookie;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const response = await fetch(baseUrl + "/app", {
                        headers,
                        redirect: "follow",
                        signal: AbortSignal.timeout(30000),
                    });
                    captureCookies(response, cookies);
                    if (response.ok) return { html: await response.text(), baseUrl };

                    lastError = new Error("GET /app returned " + response.status + " from " + baseUrl);
                    if (response.status === 403 || response.status >= 500) {
                        try {
                            const native = await nativeHttpsGet(baseUrl + "/app", headers);
                            for (const cookie of native.headers["set-cookie"] || []) {
                                const pair = cookie.split(";", 1)[0];
                                const index = pair.indexOf("=");
                                if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
                            }
                            if (native.status >= 200 && native.status < 300) return { html: native.body, baseUrl };
                            lastError = new Error("GET /app returned " + native.status + " via native HTTPS from " + baseUrl);
                        } catch (error) {
                            lastError = error;
                        }
                    }
                    if (response.status !== 403 && response.status !== 429 && response.status < 500) break;
                    const retryAfter = Number(response.headers.get("retry-after"));
                    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(30000, retryAfter * 1000) : RETRY_DELAY * attempt;
                    await response.body?.cancel();
                    if (attempt < MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, delay));
                } catch (error) {
                    lastError = error;
                    if (attempt < MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt));
                }
            }
        } catch (error) {
            lastError = error;
        }
        console.warn("[client] " + (lastError?.message || "failed to fetch /app") + "; trying the next Discord host");
    }
    throw lastError || new Error("Unable to fetch Discord /app");
};

const main = async () => {
    if (!checkOnly) await fs.mkdir(CACHE_PATH, { recursive: true });
    const started = Date.now();

    const indexFile = path.join(CACHE_PATH, "index.html");
    let html;
    let clientBaseUrl = BASE_URL;
    if (checkOnly && !existsSync(indexFile)) throw new Error("Client index.html is missing; generate a snapshot before checking it");
    if (onlyMissing && existsSync(indexFile)) {
        html = await fs.readFile(indexFile, "utf8");
    } else {
        const page = await fetchAppPage();
        html = page.html;
        clientBaseUrl = page.baseUrl;
        if (clientBaseUrl !== BASE_URL) console.warn("[client] using fallback Discord host: " + clientBaseUrl);
    }

    if (!onlyMissing) await writeAtomic(indexFile, html);
    if (indexOnly) {
        console.log(`[client] index-only bootstrap completed: wrote ${indexFile}`);
        return;
    }

    const servedHtml = html.replace(/<!-- section:seometa -->[\s\S]*?<!-- endsection -->/, "");
    const queue = [...new Set([...servedHtml.matchAll(/\/assets\/([\w.-]+)/g)].map((m) => m[1]))];
    const seen = new Set(queue);
    const failed = [];
    let done = 0;
    let bytes = 0;

    const enqueue = (names) => {
        for (const name of names) {
            if (seen.has(name)) continue;
            seen.add(name);
            queue.push(name);
        }
    };

    const fetchAsset = async (name) => {
        const file = path.join(CACHE_PATH, name);
        const isText = TEXT_EXT.test(name);
        if (existsSync(file)) {
            if (!isText) return;
            const text = await fs.readFile(file, "utf8");
            enqueue(references(text));
            if (name.endsWith(".js")) enqueue(chunkNames(text));
            const patched = name.endsWith(".json") ? text : patch(text);
            if (!checkOnly && patched !== text) await writeAtomic(file, patched);
            return;
        }
        if (checkOnly) {
            failed.push(`missing ${name}`);
            return;
        }
        let res;
        let lastError;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                res = await fetch(`${clientBaseUrl}/assets/${name}`, {
                    headers: { "user-agent": USER_AGENT, accept: "*/*" },
                    signal: AbortSignal.timeout(30000),
                });
                if (res.ok) break;
                lastError = new Error(`${res.status} ${res.statusText || "request failed"}`);
                if (res.status !== 429 && res.status < 500) break;
            } catch (error) {
                lastError = error;
            }
            if (attempt < MAX_RETRIES) {
                const retryAfter = Number(res?.headers?.get("retry-after"));
                const delay = Number.isFinite(retryAfter) && retryAfter > 0
                    ? Math.min(30000, retryAfter * 1000)
                    : RETRY_DELAY * attempt;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        if (!res?.ok) {
            failed.push(`${lastError?.message || res?.status || "request failed"} ${name}`);
            return;
        }
        if (!isText) {
            const buf = Buffer.from(await res.arrayBuffer());
            bytes += buf.length;
            await writeAtomic(file, buf);
            return;
        }
        const text = await res.text();
        bytes += text.length;
        enqueue(references(text));
        if (name.endsWith(".js")) enqueue(chunkNames(text));
        await writeAtomic(file, name.endsWith(".json") ? text : patch(text));
    };

    const report = setInterval(() => {
        process.stdout.write(`\r${done}/${seen.size} assets, ${(bytes / 1048576).toFixed(1)} MB, ${failed.length} failed, ${Math.round((Date.now() - started) / 1000)}s   `);
    }, 1000);

    let inflight = 0;
    try {
        await Promise.all(
            Array.from({ length: CONCURRENCY }, async () => {
                while (queue.length || inflight) {
                    const name = queue.shift();
                    if (!name) {
                        await new Promise((r) => setTimeout(r, 100));
                        continue;
                    }
                    inflight++;
                    await fetchAsset(name).catch((e) => failed.push(`${e.message} ${name}`));
                    inflight--;
                    done++;
                }
            }),
        );
    } finally {
        clearInterval(report);
    }
    if (!checkOnly) await writeAtomic(path.join(CACHE_PATH, "..", "cacheFailures"), failed.join("\n"));
    if (!onlyMissing) await writeAtomic(indexFile, html);
    console.log(
        `\nDone: ${done} assets, ${(bytes / 1048576).toFixed(1)} MB in ${Math.round((Date.now() - started) / 1000)}s, ${failed.length} failed${checkOnly ? "" : " (see assets/cacheFailures)"}`,
    );
    if (failed.length) {
        console.warn(`Warning: ${failed.length} client assets could not be cached; the client index was still published.`);
        if (checkOnly) throw new Error(`${failed.length} client assets are missing: ${failed.slice(0, 20).join(", ")}`);
    }
};

module.exports = { chunkNames, references, patch };
if (require.main === module)
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
