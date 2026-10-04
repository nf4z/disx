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

export const PRIDE_BADGES = [
    {
        slug: "rainbow",
        id: "8000000000000000001",
        description: "Rainbow",
        icon: "pride_rainbow",
    },
    {
        slug: "original-rainbow",
        id: "8000000000000000002",
        description: "Original rainbow (eight stripes)",
        icon: "pride_original_rainbow",
    },
    {
        slug: "philadelphia",
        id: "8000000000000000003",
        description: "Philadelphia",
        icon: "pride_philadelphia",
    },
    {
        slug: "progress",
        id: "8000000000000000004",
        description: "Progress",
        icon: "pride_progress",
    },
    {
        slug: "intersex-progress",
        id: "8000000000000000005",
        description: "Intersex-inclusive Progress",
        icon: "pride_intersex_progress",
    },
    {
        slug: "transgender",
        id: "8000000000000000006",
        description: "Transgender",
        icon: "pride_transgender",
    },
    {
        slug: "bisexual",
        id: "8000000000000000007",
        description: "Bisexual",
        icon: "pride_bisexual",
    },
    {
        slug: "pansexual",
        id: "8000000000000000008",
        description: "Pansexual",
        icon: "pride_pansexual",
    },
    {
        slug: "lesbian-five",
        id: "8000000000000000009",
        description: "Lesbian (five stripes)",
        icon: "pride_lesbian_five",
    },
    {
        slug: "lesbian-seven",
        id: "8000000000000000010",
        description: "Lesbian (seven stripes)",
        icon: "pride_lesbian_seven",
    },
    {
        slug: "gay-five",
        id: "8000000000000000011",
        description: "Gay men (five stripes)",
        icon: "pride_gay_five",
    },
    {
        slug: "gay-seven",
        id: "8000000000000000012",
        description: "Gay men (seven stripes)",
        icon: "pride_gay_seven",
    },
    {
        slug: "asexual",
        id: "8000000000000000013",
        description: "Asexual",
        icon: "pride_asexual",
    },
    {
        slug: "aromantic",
        id: "8000000000000000014",
        description: "Aromantic",
        icon: "pride_aromantic",
    },
    {
        slug: "aroace",
        id: "8000000000000000015",
        description: "Aroace (sunset)",
        icon: "pride_aroace",
    },
    {
        slug: "agender",
        id: "8000000000000000016",
        description: "Agender",
        icon: "pride_agender",
    },
    {
        slug: "nonbinary",
        id: "8000000000000000017",
        description: "Nonbinary",
        icon: "pride_nonbinary",
    },
    {
        slug: "genderqueer",
        id: "8000000000000000018",
        description: "Genderqueer",
        icon: "pride_genderqueer",
    },
    {
        slug: "genderfluid",
        id: "8000000000000000019",
        description: "Genderfluid",
        icon: "pride_genderfluid",
    },
    {
        slug: "demiboy",
        id: "8000000000000000020",
        description: "Demiboy",
        icon: "pride_demiboy",
    },
    {
        slug: "demigirl",
        id: "8000000000000000021",
        description: "Demigirl",
        icon: "pride_demigirl",
    },
    {
        slug: "demigender",
        id: "8000000000000000022",
        description: "Demigender",
        icon: "pride_demigender",
    },
    {
        slug: "demisexual",
        id: "8000000000000000023",
        description: "Demisexual",
        icon: "pride_demisexual",
    },
    {
        slug: "demiromantic",
        id: "8000000000000000024",
        description: "Demiromantic",
        icon: "pride_demiromantic",
    },
    {
        slug: "gray-asexual",
        id: "8000000000000000025",
        description: "Gray-asexual",
        icon: "pride_gray_asexual",
    },
    {
        slug: "grayromantic",
        id: "8000000000000000026",
        description: "Grayromantic",
        icon: "pride_grayromantic",
    },
    {
        slug: "polysexual",
        id: "8000000000000000027",
        description: "Polysexual",
        icon: "pride_polysexual",
    },
    {
        slug: "omnisexual",
        id: "8000000000000000028",
        description: "Omnisexual",
        icon: "pride_omnisexual",
    },
    {
        slug: "intersex",
        id: "8000000000000000029",
        description: "Intersex",
        icon: "pride_intersex",
    },
    {
        slug: "abrosexual",
        id: "8000000000000000030",
        description: "Abrosexual",
        icon: "pride_abrosexual",
    },
    {
        slug: "unlabeled",
        id: "8000000000000000031",
        description: "Unlabeled",
        icon: "pride_unlabeled",
    },
    {
        slug: "neutrois",
        id: "8000000000000000032",
        description: "Neutrois",
        icon: "pride_neutrois",
    },
    {
        slug: "androgyne",
        id: "8000000000000000033",
        description: "Androgyne",
        icon: "pride_androgyne",
    },
] as const;

export const prideBadges = (selected: readonly string[] | null | undefined) =>
    [...new Set(selected ?? [])].flatMap((slug) => {
        const badge = PRIDE_BADGES.find((item) => item.slug === slug);
        return badge ? [{ id: badge.id, description: badge.description, icon: badge.icon }] : [];
    });
