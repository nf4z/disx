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

import definePlugin from "@utils/types";
import { LarpCordAuthor } from "../larpcordCore/shared";

export default definePlugin({
    name: "LarpCordOfficialMessages",
    description: "Allows replies to this instance's official account.",
    authors: [LarpCordAuthor],
    required: true,
    patches: [
        {
            find: "isSystemDM(){let",
            replacement: {
                match: /isSystemDM\(\)\{let (\i)=this\.rawRecipients\[0\];return([^}]+)&&!0===\1\.system\}/,
                replace: 'isSystemDM(){let $1=this.rawRecipients[0];return $2&&!0===$1.system&&!($1.username==="official"&&$1.discriminator==="0")}',
            },
        },
    ],
});
