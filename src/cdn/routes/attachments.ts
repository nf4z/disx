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

import { Request, Response, Router, raw, NextFunction } from "express";
import multerConfig from "multer";
import { fileTypeFromBuffer } from "file-type";
import imageSize from "image-size";
import { HTTPError } from "lambert-server/HTTPError";
import { Attachment, CloudAttachment, getDatabase } from "@spacebar/database";
import { Config, extractVideoFrame, hasValidSignature, readVideoDimensions, NewUrlUserSignatureData, Snowflake, UrlSignResult } from "@spacebar/util";
import { storage, multer, setCacheControl } from "../util";
import { InternalCdnAttachment } from "@spacebar/util/dtos/MessageOptions";

import { declaredCloudUploadLimit, requireCloudUploadReservation, requireInternalUploadSignature } from "../util/cloudUploads";

const router = Router({ mergeParams: true });

const SANITIZED_CONTENT_TYPE = ["text/html", "text/mhtml", "multipart/related", "application/xhtml+xml"];

router.post("/:channel_id/:message_id", requireInternalUploadSignature, multer.single("file"), async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");

    if (!req.file) throw new HTTPError("file missing");

    const { buffer, mimetype, size, originalname } = req.file;
    const { channel_id, message_id } = req.params as { [key: string]: string };
    const filename = originalname.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]+/g, "");
    const attachment_id = Snowflake.generate();
    const path = `attachments/${channel_id}/${attachment_id}/${filename}`;

    const endpoint = Config.get()?.cdn.endpointPublic?.replace(/\/+$/, "");

    await storage.set(path, buffer);
    let width;
    let height;
    if (mimetype.includes("image")) {
        try {
            const dimensions = imageSize(buffer);
            if (dimensions) {
                width = dimensions.width;
                height = dimensions.height;
            }
        } catch (e) {
            console.warn("Failed to get image size for attachment of type", mimetype, "because of", e);
        }
    }

    const finalUrl = `${endpoint}/${path}`;

    const file: InternalCdnAttachment = {
        id: attachment_id,
        channel_id,
        message_id,
        content_type: mimetype,
        filename: filename,
        size,
        url: finalUrl,
        path,
        width,
        height,
    };

    return res.json(file);
});

router.get("/:channel_id/:attachment_id/:filename", setCacheControl, async (req: Request, res: Response) => {
    const { channel_id, attachment_id, filename } = req.params as { [key: string]: string };
    // const { format } = req.query;
    if (!/^\d+$/.test(channel_id) || !/^\d+$/.test(attachment_id)) throw new HTTPError("File not found", 404);

    const path = `attachments/${channel_id}/${attachment_id}/${filename}`;

    const fullUrl = (req.headers["x-forwarded-proto"] ?? req.protocol) + "://" + (req.headers["x-forwarded-host"] ?? req.hostname) + req.originalUrl;

    let hasValidAuth = false;
    if (req.headers.signature) {
        hasValidAuth = req.headers.signature === Config.get().security.requestSignature;
        if (!hasValidAuth) console.warn("[CDN/Attachments] Client sent invalid signature header");
    } else if (!Config.get().security.cdnSignUrls) {
        hasValidAuth = true;
    } else {
        hasValidAuth = hasValidSignature(
            new NewUrlUserSignatureData({
                ip: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }),
            UrlSignResult.fromUrl(fullUrl),
        );
        if (!hasValidAuth) console.warn("[CDN/Attachments] Client sent invalid attachment URL signature");
    }

    if (!hasValidAuth) return res.status(404).send("This content is no longer available.");

    let file = await storage.get(path);
    if (!file) {
        const att = await Attachment.findOne({
            where: {
                channel_id,
                id: attachment_id,
            },
        });

        if (att) {
            const attPath = `attachments/${channel_id}/${att.message_id}/${filename}`;
            if (await storage.exists(attPath)) await storage.move(attPath, path).catch(() => undefined);
            file = await storage.get(path);
        }
    }
    if (!file) throw new HTTPError("File not found", 404);
    const type = await fileTypeFromBuffer(file);

    if (req.query.format && type?.mime.startsWith("video/")) {
        const frame = await extractVideoFrame(file);
        if (!frame) return res.status(415).send("Unable to render a preview frame");
        res.set("Content-Type", "image/jpeg");
        return res.send(frame);
    }

    if (type) res.set("Content-Type", SANITIZED_CONTENT_TYPE.includes(type.mime) ? "application/octet-stream" : type.mime);
    else {
        res.type(filename);
        const guessed = String(res.get("Content-Type"));
        if (SANITIZED_CONTENT_TYPE.some((x) => guessed.startsWith(x)) || /^(text\/(javascript|xml)|image\/svg)/.test(guessed)) res.set("Content-Type", "text/plain; charset=utf-8");
        else if (!guessed.startsWith("text/") && !guessed.startsWith("application/json")) res.set("Content-Type", "application/octet-stream");
    }

    return res.send(file);
});

router.delete("/:channel_id/:attachment_id/:filename", async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");

    const { channel_id, attachment_id, filename } = req.params as { [key: string]: string };
    const path = `attachments/${channel_id}/${attachment_id}/${filename}`;

    await storage.delete(path);

    return res.send({ success: true });
});

function parseCloudUpload(req: Request, res: Response, next: NextFunction) {
    const limit = declaredCloudUploadLimit(res.locals.cloudAttachment);
    const parser = req.is("multipart/form-data")
        ? multerConfig({ storage: multerConfig.memoryStorage(), limits: { fileSize: limit, files: 1, fields: 10, fieldSize: 1024, parts: 11, headerPairs: 64 } }).single("file")
        : raw({ type: () => true, limit, inflate: false });
    parser(req, res, (error) => {
        if (error instanceof multerConfig.MulterError && error.code === "LIMIT_FILE_SIZE") return next(new HTTPError("File too large", 413));
        return next(error);
    });
}

router.put("/:channel_id/:batch_id/:attachment_id/:filename", requireCloudUploadReservation, parseCloudUpload, async (req: Request, res: Response) => {
    const { channel_id, batch_id, attachment_id, filename } = req.params as { [key: string]: string };
    const buffer = req.file?.buffer ?? req.body ?? (res.locals.cloudAttachment.userFileSize === 0 ? Buffer.alloc(0) : undefined);
    if (!Buffer.isBuffer(buffer)) throw new HTTPError("file missing", 400);
    if (buffer.length > Config.get().cdn.maxAttachmentSize) throw new HTTPError("File too large", 413);

    await getDatabase()!.transaction(async (manager) => {
        const att = await manager.getRepository(CloudAttachment).findOne({
            lock: { mode: "pessimistic_write" },
            where: {
                uploadFilename: `${channel_id}/${batch_id}/${attachment_id}/${filename}`,
                channelId: channel_id,
                userAttachmentId: attachment_id,
                userFilename: filename,
            },
        });
        if (!att || !att.userId) throw new HTTPError("Attachment not found", 404);
        if (buffer.length > declaredCloudUploadLimit(att)) throw new HTTPError("File too large", 413);

        const path = `attachments/${channel_id}/${batch_id}/${attachment_id}/${filename}`;
        let mimeType = att.userOriginalContentType;
        if (mimeType === null) {
            const ft = await fileTypeFromBuffer(buffer);
            mimeType = att.contentType = ft?.mime || "application/octet-stream";
        }

        try {
            const dimensions = mimeType?.includes("image") ? imageSize(buffer) : mimeType?.startsWith("video/") ? readVideoDimensions(buffer) : undefined;
            if (dimensions) {
                att.width = dimensions.width;
                att.height = dimensions.height;
            }
        } catch {
            att.width = undefined;
            att.height = undefined;
        }

        await storage.set(path, buffer);
        att.size = buffer.length;
        await manager.save(att);
    });
    return res.status(200).end();
});

router.delete("/:channel_id/:batch_id/:attachment_id/:filename", async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");

    const { channel_id, batch_id, attachment_id, filename } = req.params as { [key: string]: string };
    const path = `attachments/${channel_id}/${batch_id}/${attachment_id}/${filename}`;

    const att = await CloudAttachment.findOne({
        where: {
            uploadFilename: `${channel_id}/${batch_id}/${attachment_id}/${filename}`,
            channelId: channel_id,
            userAttachmentId: attachment_id,
            userFilename: filename,
        },
    });

    if (att) {
        await att.remove();
        await storage.delete(path);
        return res.send({ success: true });
    }
    return res.status(404).send("Attachment not found");
});

router.post("/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id", async (req: Request, res: Response) => {
    if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");

    const { channel_id, batch_id, attachment_id, filename, message_id } = req.params as { [key: string]: string };
    const target = typeof req.query.channel_id === "string" && /^\d+$/.test(req.query.channel_id) ? req.query.channel_id : channel_id;
    const path = `attachments/${channel_id}/${batch_id}/${attachment_id}/${filename}`;
    const newPath = `attachments/${target}/${message_id}/${filename}`;

    const att = await CloudAttachment.findOne({
        where: {
            uploadFilename: `${channel_id}/${batch_id}/${attachment_id}/${filename}`,
            channelId: channel_id,
            userAttachmentId: attachment_id,
            userFilename: filename,
        },
    });

    if (att) {
        await storage.clone(path, newPath);
        return res.send({ success: true, new_path: newPath });
    }

    return res.status(404).send("Attachment not found");
});

export default router;
