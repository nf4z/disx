/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import { Request, Response, Router } from "express";
import imageSize from "image-size";
import { route } from "@spacebar/api/middlewares";
import { Application, ApplicationWidgetConfig } from "@spacebar/database";
import { DiscordApiErrors, FieldErrors, Snowflake, deleteFile, handleFile } from "@spacebar/util";
import { MAX_WIDGET_ASSETS, parseWidgetSurfaces } from "@spacebar/api/util/handlers/ApplicationWidgets";

const router = Router({ mergeParams: true });
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ownedApplication = async (req: Request) => {
    const app = await Application.findOne({ where: { id: req.params.application_id as string }, select: { id: true, owner_id: true, widget_config: true, widget_public: true } });
    if (!app) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (app.owner_id !== req.user_id) throw DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION;
    return app;
};

const emptyConfig = (): ApplicationWidgetConfig => ({ config_id: Snowflake.generate(), surfaces: {}, assets: [], updated_at: new Date().toISOString() });

router.get("/", route({ responses: { 200: {}, 403: { body: "APIErrorResponse" } } }), async (req: Request, res: Response) => {
    const app = await ownedApplication(req);
    res.json({ config: app.widget_config ?? null, public: app.widget_public });
});

router.put("/", route({ responses: { 200: {}, 400: { body: "APIErrorResponse" }, 403: { body: "APIErrorResponse" } } }), async (req: Request, res: Response) => {
    const app = await ownedApplication(req);
    const body = req.body as { surfaces?: unknown; public?: unknown };
    const config = app.widget_config ?? emptyConfig();
    const surfaces = parseWidgetSurfaces(body.surfaces, new Set(config.assets.map((asset) => asset.key)));

    // Images no field points at any more are deleted, so uploads that were replaced don't pile up.
    const used = new Set(
        JSON.stringify(surfaces)
            .match(/"value":"[^"]+"/g)
            ?.map((x) => x.slice(9, -1)),
    );
    const [kept, dropped] = [config.assets.filter((asset) => used.has(asset.key)), config.assets.filter((asset) => !used.has(asset.key))];
    const next: ApplicationWidgetConfig = { ...config, surfaces, assets: kept, updated_at: new Date().toISOString() };
    await Application.update({ id: app.id }, { widget_config: next, ...(typeof body.public === "boolean" && { widget_public: body.public }) });
    await Promise.all(dropped.map((asset) => deleteFile(`/app-assets/${app.id}/${asset.asset_id}`).catch(() => null)));
    res.json({ config: next, public: typeof body.public === "boolean" ? body.public : app.widget_public });
});

router.delete("/", route({ responses: { 204: {}, 403: { body: "APIErrorResponse" } } }), async (req: Request, res: Response) => {
    const app = await ownedApplication(req);
    await Application.update({ id: app.id }, { widget_config: null, widget_public: false });
    await Promise.all((app.widget_config?.assets ?? []).map((asset) => deleteFile(`/app-assets/${app.id}/${asset.asset_id}`).catch(() => null)));
    res.sendStatus(204);
});

// Uploads an image for the widget. It's kept until a saved config stops using it.
router.post("/assets", route({ responses: { 201: {}, 400: { body: "APIErrorResponse" }, 403: { body: "APIErrorResponse" } } }), async (req: Request, res: Response) => {
    const app = await ownedApplication(req);
    const { image } = req.body as { image?: unknown };
    const imageError = (message: string) => FieldErrors({ image: { code: "IMAGE_INVALID", message } });
    if (typeof image !== "string" || !/^data:image\/(png|jpeg|gif|webp);base64,/.test(image)) throw imageError("Upload a PNG, JPEG, GIF or WebP image.");
    const buffer = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
    if (buffer.length > MAX_IMAGE_BYTES) throw imageError("Images can be up to 8 MB.");
    let dimensions: { width?: number; height?: number };
    try {
        dimensions = imageSize(buffer);
    } catch {
        throw imageError("This image couldn't be read.");
    }
    if (!dimensions.width || !dimensions.height) throw imageError("This image couldn't be read.");

    const config = app.widget_config ?? emptyConfig();
    if (config.assets.length >= MAX_WIDGET_ASSETS) throw imageError(`A widget can have up to ${MAX_WIDGET_ASSETS} images. Save your widget to free up replaced ones.`);
    const id = await handleFile(`/app-assets/${app.id}`, image);
    if (!id) throw imageError("Upload a PNG, JPEG, GIF or WebP image.");
    const existing = config.assets.find((asset) => asset.asset_id === id);
    const asset = existing ?? { key: id, asset_id: id, width: dimensions.width, height: dimensions.height, is_animated: id.startsWith("a_"), updated_at: new Date().toISOString() };
    if (!existing) await Application.update({ id: app.id }, { widget_config: { ...config, assets: [...config.assets, asset] } });
    res.status(201).json(asset);
});

export default router;
