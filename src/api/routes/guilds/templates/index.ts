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

import { Request, Response, Router } from "express";
import { route } from "@spacebar/api/middlewares";
import { applyTemplateSettings, resolveGuildTemplate } from "@spacebar/api/util";
import { Guild, Member, Template } from "@spacebar/database";
import { Config, DiscordApiErrors } from "@spacebar/util";
import { GuildTemplateCreateSchema } from "@spacebar/schemas";

const router: Router = Router({ mergeParams: true });

// the code can also be a template link (discord.new/<code>); codes this instance doesn't know are looked up on discord
router.get(
    "/:template_code",
    route({
        // the /template/<code> page shows the template before anyone logs in
        authentication: "optional",
        responses: {
            200: {
                body: "Template",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { template_code } = req.params as { [key: string]: string };

        const template = await resolveGuildTemplate(template_code);

        res.json(template);
    },
);

router.post("/:template_code", route({ requestBody: "GuildTemplateCreateSchema" }), async (req: Request, res: Response) => {
    const { template_code } = req.params as { [key: string]: string };
    const body = req.body as GuildTemplateCreateSchema;

    const { maxGuilds } = Config.get().limits.user;

    const guild_count = await Member.count({ where: { id: req.user_id } });
    if (guild_count >= maxGuilds) throw DiscordApiErrors.MAXIMUM_GUILDS.withParams(maxGuilds);

    const template = await resolveGuildTemplate(template_code);

    const guild = await Guild.createGuild({
        ...template.serialized_source_guild,
        // body comes after the template
        ...body,
        owner_id: req.user_id,
        source_guild_id: template.source_guild_id,
    });
    await applyTemplateSettings(guild.id, template.serialized_source_guild);

    await Member.addToGuild(req.user_id, guild.id);
    if (template instanceof Template) await Template.update({ code: template.code }, { usage_count: (template.usage_count ?? 0) + 1 });

    res.status(201).json(await Guild.findOneOrFail({ where: { id: guild.id }, relations: { roles: true, channels: true } }));
});

export default router;
