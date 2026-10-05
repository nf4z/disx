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

import type { ReactNode } from "react";
import { Button as NativeButton, Forms, Text, TextInput } from "@webpack/common";

export function SettingsSection({ title, description, className, children }: { title: string; description?: string; className?: string; children: ReactNode }) {
    return (
        <section className={className} aria-label={title}>
            <div className="larpcord-ui-section-heading">
                <Forms.FormTitle tag="h3">{title}</Forms.FormTitle>
                {description && (
                    <Text variant="text-sm/normal" color="text-muted">
                        {description}
                    </Text>
                )}
            </div>
            {children}
        </section>
    );
}

export function Field({
    id,
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    className,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: "text" | "search";
    className?: string;
}) {
    return (
        <div className={className}>
            <label htmlFor={id}>
                <Text variant="text-sm/medium">{label}</Text>
            </label>
            <TextInput id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} />
        </div>
    );
}

export function Button({ variant = "primary", disabled, onClick, children }: { variant?: "primary" | "secondary"; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <NativeButton
            type="button"
            color={variant === "secondary" ? NativeButton.Colors.PRIMARY : NativeButton.Colors.BRAND}
            size={NativeButton.Sizes.SMALL}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </NativeButton>
    );
}
