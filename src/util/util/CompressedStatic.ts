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

import { RequestHandler } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { ClientAssetCompression, clientAssetVersion } from "../../bundle/ClientAssetCompression";

const cache = new ClientAssetCompression({ bytes: 32 * 1024 * 1024, entries: 64, sourceBytes: 8 * 1024 * 1024, inflight: 4 });
const compressible = /\.(?:js|css|json|svg|wasm)$/i;

export function compressedStatic(directory: string): RequestHandler {
    const root = path.resolve(directory);
    return async (req, res, next) => {
        if (!["GET", "HEAD"].includes(req.method)) return next();
        let pathname: string;
        try {
            pathname = decodeURIComponent(req.path);
        } catch {
            return next();
        }
        if (!compressible.test(pathname) || pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").some((part) => part.startsWith("."))) return next();
        const source = path.resolve(root, `.${pathname}`);
        if (!source.startsWith(`${root}${path.sep}`)) return next();
        try {
            const stat = await fs.stat(source).catch(() => null);
            if (!stat?.isFile() || stat.size < 1024) return next();
            const [realRoot, realSource] = await Promise.all([fs.realpath(root), fs.realpath(source)]);
            if (!realSource.startsWith(`${realRoot}${path.sep}`)) return void res.sendStatus(403);
            res.vary("Accept-Encoding");
            if (req.headers.range || !req.headers["accept-encoding"]) return next();
            const encoding = req.acceptsEncodings("br", "gzip", "identity");
            if (!encoding) return void res.status(406).end();
            if (encoding !== "br" && encoding !== "gzip") return next();
            const body = await cache.get(source, stat, encoding);
            if (!body) {
                if (req.acceptsEncodings("identity")) return next();
                return void res.status(503).set("Retry-After", "1").end();
            }
            res.set({
                "Cache-Control": "no-cache",
                "Content-Encoding": encoding,
                ETag: `W/"${createHash("sha256").update(clientAssetVersion(stat)).digest("hex")}-${encoding}"`,
                "Content-Length": String(body.length),
            });
            res.type(path.extname(source));
            if (req.fresh) {
                res.removeHeader("Content-Length");
                res.removeHeader("Content-Encoding");
                return void res.status(304).end();
            }
            if (req.method === "HEAD") return void res.end();
            res.end(body);
        } catch (error) {
            next(error);
        }
    };
}
