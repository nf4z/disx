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

import { AdminChannelUpdateSchema, AdminRoleUpdateSchema } from "./Admin";

export interface AdminChannelCreateSchema extends AdminChannelUpdateSchema {
    /** @minLength 1
     * @maxLength 100 */
    name: string;
    type?: 0 | 2 | 4 | 5 | 13 | 15 | 16;
    /** @pattern ^[0-9]{15,20}$ */
    parent_id?: string | null;
    /** @minimum 8000
     * @maximum 384000
     * @TJS-type integer */
    bitrate?: number;
    /** @minimum 0
     * @maximum 99
     * @TJS-type integer */
    user_limit?: number;
}

export interface AdminRoleCreateSchema extends AdminRoleUpdateSchema {
    /** @minLength 1
     * @maxLength 100 */
    name: string;
}
