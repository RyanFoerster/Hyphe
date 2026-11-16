// Les projets du studio : uniquement de vrais projets (médias dans public/work).
// Les cinq projets fictifs du début ont été retirés en novembre 2026, à la
// demande de Ryan. Un projet sans `media` reste possible : ses visuels sont
// alors générés (lib/generative), et `concept: true` le signale comme une étude.
// Les noms passent en Parceh : lettres, espaces, virgules et points seulement.
// Formats d'image : 16:9 et 4:5 uniquement.

export type VisualKind = 'topo' | 'strata' | 'bloom';

export interface Project {
	slug: string;
	name: string;
	client: string;
	year: number;
	category: string;
	services: string[];
	/** Une phrase pour les cartes et le partage */
	summary: string;
	/** Le mot du résumé mis en exergue (boîte de suivi) */
	highlight: string;
	/** Fiche du projet : une accroche courte (en Parceh : lettres, virgules, points) et le lieu */
	tagline: string;
	locality: string;
	intro: string;
	challenge: string;
	approach: string[];
	results?: { value: string; label: string }[];
	visual: {
		kind: VisualKind;
		seed: number;
		bg: string;
		line: string;
		accent: string;
	};
	/** Adresse du site livré, sans protocole */
	url?: string;
	/** Projet fictif (étude du studio, pas une commande) */
	concept?: boolean;
	/** Vrais médias. Sans eux, les visuels sont générés (lib/generative). */
	media?: {
		/** Image 16:9 des cartes, spécimens et partages */
		cover: string;
		/** Vidéo 16:9 du hero, avec son image d'attente */
		heroVideo?: string;
		heroPoster?: string;
		gallery: Plate[];
	};
}

export type Ratio = '16/9' | '4/5';
export interface Plate {
	src: string;
	ratio: Ratio;
	caption: string;
	/** browser : la capture est montrée dans une fenêtre de navigateur */
	kind?: 'image' | 'video' | 'browser';
	poster?: string;
}

/** Image de couverture : le vrai média ou le visuel généré */
export const coverOf = (p: Project) => p.media?.cover ?? `/visuals/${p.slug}.svg`;

/** Les planches d'un projet, dans l'ordre de la page */
export function platesOf(p: Project): Plate[] {
	if (p.media) return p.media.gallery;
	const v = (n: number) => `/visuals/${p.slug}/${n}.svg`;
	return [
		{ src: v(1), ratio: '16/9', caption: 'key visual' },
		{ src: `/visuals/${p.slug}.svg`, ratio: '16/9', caption: 'website, home', kind: 'browser' },
		{ src: v(3), ratio: '4/5', caption: 'detail, line work' },
		{ src: v(2), ratio: '16/9', caption: 'system, second family' },
		{ src: v(4), ratio: '4/5', caption: 'mobile, home' },
		{ src: v(5), ratio: '4/5', caption: 'mobile, story' },
		{ src: v(6), ratio: '4/5', caption: 'mobile, detail' },
		{ src: v(5), ratio: '16/9', caption: 'motion still, frame 0284' },
	];
}

/** Une image 4:5 d'un projet (planches de l'herbier, cartes) */
export const portraitOf = (p: Project, i = 0) => platesOf(p).filter((x) => x.ratio === '4/5' && x.kind !== 'video')[i]?.src ?? coverOf(p);

export const projects: Project[] = [
	{
		slug: 'loum',
		tagline: 'Endless contact sheet',
		locality: 'Belgium',
		name: 'Loum',
		client: 'Loum',
		year: 2026,
		category: 'Studio website',
		services: ['Web design', 'Creative development', 'Infinite grid', 'Keystatic CMS'],
		summary: 'An endless, draggable contact sheet for an independent Belgian design studio.',
		highlight: 'contact sheet',
		intro:
			'Loum is an independent design studio shaping brands, identities and worlds. Their work lives in images, so the website is made of nothing else: every image of every project, laid out on an endless contact sheet you can drag in every direction.',
		challenge:
			'Show everything at once without turning it into noise, stay fast with hundreds of high-resolution images, and let the studio update the whole thing on its own.',
		approach: [
			'An infinite grid you drag like a light table. Images are dealt out one project at a time so neighbours rarely share a project, while a live readout shows coordinates and speed.',
			'Project pages keep the print logic of the studio: crop marks, pixel dimensions, an index number, and the next project already waiting at the end of the page.',
			'Content lives in Keystatic: images are optimised at build time, videos and GIFs stay as they are. Deployed on Vercel.',
		],
		visual: { kind: 'strata', seed: 5, bg: '#f2f1ec', line: '#1c1c1a', accent: '#e6e4dc' },
		url: 'studioloum.com',
		media: {
			cover: '/work/loum/home.webp',
			heroVideo: '/work/loum/grid.mp4',
			heroPoster: '/work/loum/grid-poster.webp',
			gallery: [
				{ src: '/work/loum/home-drag.webp', ratio: '16/9', caption: 'index, the contact sheet' },
				{ src: '/work/loum/m-home.webp', ratio: '4/5', caption: 'mobile, index' },
				{ src: '/work/loum/m-drag.webp', ratio: '4/5', caption: 'mobile, dragging the sheet' },
				{ src: '/work/loum/project.webp', ratio: '16/9', caption: 'project page, Biche', kind: 'browser' },
				{ src: '/work/loum/m-project.webp', ratio: '4/5', caption: 'mobile, project' },
				{ src: '/work/loum/m-scroll.webp', ratio: '4/5', caption: 'mobile, figures' },
				{ src: '/work/loum/m-lire.webp', ratio: '4/5', caption: 'mobile, project file' },
				{ src: '/work/loum/grid.mp4', ratio: '16/9', caption: 'motion, dragging the grid', kind: 'video', poster: '/work/loum/grid-poster.webp' },
				{ src: '/work/loum/project-scroll.webp', ratio: '16/9', caption: 'project page, Lire le rap' },
				{ src: '/work/loum/m-about.webp', ratio: '4/5', caption: 'mobile, studio file' },
				{ src: '/work/loum/m-info.webp', ratio: '4/5', caption: 'mobile, project sheet' },
				{ src: '/work/loum/about.webp', ratio: '16/9', caption: 'about, over a project', kind: 'browser' },
			],
		},
	},
	{
		slug: 'farmlize',
		tagline: 'Farms, near you',
		locality: 'Belgium',
		name: 'Farmlize',
		client: 'Farmlize',
		year: 2026,
		category: 'Web app',
		services: ['Product design', 'Illustration', 'Creative development', 'Maps'],
		summary: 'A map of the farms, market gardeners and cheesemakers near you, drawn like a risograph print.',
		highlight: 'risograph',
		intro:
			'Farmlize helps people in Belgium find the farms, market gardeners, cheesemakers and craftspeople around them, and buy straight from the field. Eating local should feel like a day out at the market, so the whole app is drawn like a risograph print: bold inks, simple shapes, grainy shading.',
		challenge:
			'Make a directory of small producers feel warm rather than administrative, keep a live map fast on a phone in the middle of a field, and give every farm a face even when it has no photos yet.',
		approach: [
			'A two-step onboarding: your commune, then what you crave. The products fly into a basket, and the explorer opens already filtered around you.',
			'The explorer pairs a filterable list with a recoloured vector map, synchronised both ways: radius, open now, favourites, and every farm page with its hours of the day, its products in season and a word from the producer.',
			'Everything is illustrated in SVG, in risograph inks: a generated cover for each farm, forty-five fruits and vegetables for the seasonal calendar, grain and misprinted colour plates done with filters and masks.',
		],
		results: [
			{ value: '45', label: 'seasonal illustrations, all SVG' },
			{ value: '24', label: 'farms on the prototype map' },
			{ value: '58', label: 'Belgian communes in the search' },
		],
		visual: { kind: 'bloom', seed: 11, bg: '#fcfaf2', line: '#352200', accent: '#f07a2a' },
		url: 'farmlize.ryanfoerster.dev',
		media: {
			cover: '/work/farmlize/home.webp',
			heroVideo: '/work/farmlize/home.mp4',
			heroPoster: '/work/farmlize/home-poster.webp',
			gallery: [
				{ src: '/work/farmlize/how.webp', ratio: '16/9', caption: 'home, three steps to the farm' },
				{ src: '/work/farmlize/m-home.webp', ratio: '4/5', caption: 'mobile, home' },
				{ src: '/work/farmlize/m-start.webp', ratio: '4/5', caption: 'mobile, onboarding' },
				{ src: '/work/farmlize/farms.webp', ratio: '16/9', caption: 'explorer, list and map', kind: 'browser' },
				{ src: '/work/farmlize/m-farms.webp', ratio: '4/5', caption: 'mobile, explorer' },
				{ src: '/work/farmlize/m-farm.webp', ratio: '4/5', caption: 'mobile, farm page' },
				{ src: '/work/farmlize/m-seasons.webp', ratio: '4/5', caption: 'mobile, seasons' },
				{ src: '/work/farmlize/tour.mp4', ratio: '16/9', caption: 'motion, the home page', kind: 'video', poster: '/work/farmlize/tour-poster.webp' },
				{ src: '/work/farmlize/farm.webp', ratio: '16/9', caption: 'farm page, Ferme du Soleil' },
				{ src: '/work/farmlize/start.webp', ratio: '16/9', caption: 'onboarding, where are you?' },
				{ src: '/work/farmlize/seasons.webp', ratio: '16/9', caption: 'seasonal calendar', kind: 'browser' },
				{ src: '/work/farmlize/picks.webp', ratio: '16/9', caption: 'favourite farms' },
				{ src: '/work/farmlize/pro.webp', ratio: '16/9', caption: 'producers, join the map', kind: 'browser' },
			],
		},
	},
];
