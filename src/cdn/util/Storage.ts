/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors
	
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

import path from "node:path";
import fs from "node:fs";
import { red } from "picocolors";
process.cwd();

export interface Storage {
    set(path: string, data: Buffer): Promise<void>;
    clone(path: string, newPath: string): Promise<void>;
    get(path: string): Promise<Buffer | null>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    isFile(path: string): Promise<boolean>;
    move(path: string, newPath: string): Promise<void>;
}

let storage: Storage;

const provider = (process.env.STORAGE_PROVIDER || "file").toLowerCase();

if (provider === "file") {
    let location = process.env.STORAGE_LOCATION;
    if (location) {
        location = path.resolve(location);
    } else {
        location = path.join(process.cwd(), "files");
    }
    // TODO: move this to some start func, so it doesn't run when server is imported
    //console.log(`[CDN] storage location: ${bgCyan(`${black(location)}`)}`);
    if (!fs.existsSync(location)) fs.mkdirSync(location);
    process.env.STORAGE_LOCATION = location;

    const { FileStorage } = require("./FileStorage");
    storage = new FileStorage();
} else if (provider === "s3" || provider === "r2" || provider === "cloudflare") {
    try {
        require("@aws-sdk/client-s3");
    } catch (e) {
        console.error(red(`[CDN] AWS S3 SDK not installed. Please run 'npm install @aws-sdk/client-s3' to use the ${provider} storage provider.`));
        process.exit(1);
    }

    const isR2 = provider === "r2" || provider === "cloudflare";
    const bucket = process.env.STORAGE_BUCKET || process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET || process.env.AWS_BUCKET;

    if (!bucket) {
        console.error(`[CDN] You must provide a bucket when using the ${provider} storage provider (STORAGE_BUCKET or R2_BUCKET).`);
        process.exit(1);
    }

    let region = process.env.STORAGE_REGION || process.env.R2_REGION || process.env.AWS_REGION;
    if (!region) {
        if (isR2) {
            region = "auto";
        } else {
            console.error(`[CDN] You must provide a region when using the S3 storage provider.`);
            process.exit(1);
        }
    }

    const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    let endpoint = process.env.STORAGE_ENDPOINT || process.env.R2_ENDPOINT;

    if (!endpoint) {
        if (isR2 && accountId) {
            endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
        } else if (!isR2) {
            endpoint = `https://s3.${region}.amazonaws.com`;
        } else {
            console.error(`[CDN] You must provide STORAGE_ENDPOINT or R2_ACCOUNT_ID when using Cloudflare R2.`);
            process.exit(1);
        }
    }

    const accessKeyId =
        process.env.STORAGE_ACCESS_KEY_ID ||
        process.env.STORAGE_KEY_ID ||
        process.env.R2_ACCESS_KEY_ID ||
        process.env.CLOUDFLARE_ACCESS_KEY_ID ||
        process.env.AWS_ACCESS_KEY_ID;

    const secretAccessKey =
        process.env.STORAGE_SECRET_ACCESS_KEY ||
        process.env.STORAGE_SECRET_KEY ||
        process.env.R2_SECRET_ACCESS_KEY ||
        process.env.CLOUDFLARE_SECRET_ACCESS_KEY ||
        process.env.AWS_SECRET_ACCESS_KEY;

    const credentials = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;

    // in the S3 provider, this should be the root path in the bucket
    let location = process.env.STORAGE_LOCATION;

    if (!location) {
        location = undefined;
    }

    const forcePathStyle = process.env.STORAGE_FORCE_PATH_STYLE !== undefined
        ? process.env.STORAGE_FORCE_PATH_STYLE === "true"
        : false;

    const { S3Storage } = require("./S3Storage");
    storage = new S3Storage(region, bucket, endpoint, forcePathStyle, location, credentials);
}

export { storage };
