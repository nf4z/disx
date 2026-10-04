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

import { NextFunction, Request, Response } from "express";
import { HTTPError } from "lambert-server/HTTPError";
import { CloudAttachment } from "@spacebar/database";
import { Config } from "@spacebar/util";

export function requireInternalUploadSignature(req: Request, _res: Response, next: NextFunction) {
    const signature = Config.get().security.requestSignature;
    if (typeof signature !== "string" || !signature.length || req.headers.signature !== signature) return next(new HTTPError("Invalid request signature", 403));
    return next();
}

export function declaredCloudUploadLimit(attachment: CloudAttachment): number {
    const configured = Config.get().cdn.maxAttachmentSize;
    const declared = attachment.userFileSize;
    if (!Number.isSafeInteger(configured) || configured < 1) throw new HTTPError("Uploads are unavailable", 503);
    if (typeof declared !== "number" || !Number.isSafeInteger(declared) || declared < 0 || declared > configured) throw new HTTPError("Invalid upload reservation", 400);
    return declared;
}

export async function requireCloudUploadReservation(req: Request, res: Response, next: NextFunction) {
    try {
        const { channel_id, batch_id, attachment_id, filename } = req.params as Record<string, string>;
        const attachment = await CloudAttachment.findOne({
            where: { uploadFilename: `${channel_id}/${batch_id}/${attachment_id}/${filename}`, channelId: channel_id, userAttachmentId: attachment_id, userFilename: filename },
        });
        if (!attachment || !attachment.userId) throw new HTTPError("Attachment not found", 404);
        const limit = declaredCloudUploadLimit(attachment);
        const contentLength = req.headers["content-length"];
        if (contentLength !== undefined) {
            const length = Number(contentLength);
            const overhead = req.is("multipart/form-data") ? 16 * 1024 : 0;
            if (!Number.isSafeInteger(length) || length < 0 || length > limit + overhead) throw new HTTPError("File too large", 413);
        }
        res.locals.cloudAttachment = attachment;
        return next();
    } catch (error) {
        return next(error);
    }
}
