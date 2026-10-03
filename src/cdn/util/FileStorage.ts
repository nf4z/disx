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

import fs from "node:fs";
import fsp from "node:fs/promises";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Storage } from "./Storage";
import ExifTransformer from "exif-be-gone";

export class FileStorage implements Storage {
    getFsPath(path: string): string {
        const root = resolve(process.env.STORAGE_LOCATION || "../");
        const filename = resolve(root, path);
        const child = relative(root, filename);
        if (path.includes("\0") || child === ".." || child.startsWith("../") || isAbsolute(child)) throw new Error("invalid path");
        return filename;
    }

    async isFile(path: string): Promise<boolean> {
        try {
            return (await fsp.stat(this.getFsPath(path))).isFile();
        } catch (error) {
            if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
            throw error;
        }
    }

    async get(path: string): Promise<Buffer | null> {
        path = this.getFsPath(path);
        try {
            return await fsp.readFile(path);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EISDIR") return null;
            try {
                console.warn("[CDN] Warning: falling back to first file in dir for path", path);
                const files = await fsp.readdir(path);
                if (!files.length) return null;
                return await fsp.readFile(join(path, files[0]));
            } catch {
                return null;
            }
        }
    }

    async clone(path: string, newPath: string) {
        path = this.getFsPath(path);
        newPath = this.getFsPath(newPath);
        await fsp.mkdir(dirname(newPath), { recursive: true });
        await fsp.copyFile(path, newPath, fs.constants.COPYFILE_FICLONE);
    }

    async set(path: string, value: Buffer) {
        path = this.getFsPath(path);
        await fsp.mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.${randomUUID()}.tmp`;
        try {
            await pipeline(Readable.from(value), new ExifTransformer(), fs.createWriteStream(temporary, { flags: "wx" }));
            await fsp.rename(temporary, path);
        } finally {
            await fsp.unlink(temporary).catch((error: NodeJS.ErrnoException) => {
                if (error.code !== "ENOENT") throw error;
            });
        }
    }

    async delete(path: string) {
        try {
            await fsp.unlink(this.getFsPath(path));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
    }

    async exists(path: string) {
        try {
            await fsp.access(this.getFsPath(path));
            return true;
        } catch (error) {
            if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
            throw error;
        }
    }

    async move(path: string, newPath: string) {
        path = this.getFsPath(path);
        newPath = this.getFsPath(newPath);
        await fsp.mkdir(dirname(newPath), { recursive: true });
        await fsp.rename(path, newPath);
    }
}
