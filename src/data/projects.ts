// Les projets du studio. Loum est réel (médias dans public/work/loum) ; les
// autres sont FICTIFS, clients et chiffres inventés, à remplacer.
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
	/** Fiche d'herbier : nom latin (inventé) et lieu de récolte */
	latin: string;
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
		latin: 'Loumia gridiflora',
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
		latin: 'Fermia vicinalis',
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
	{
		slug: 'lichen-archive',
		latin: 'Cladonia archiva',
		locality: 'Paris, FR',
		name: 'Lichen Archive',
		client: 'Musée des Sols',
		year: 2026,
		category: 'Digital museum',
		services: ['Art direction', 'WebGL', 'Web platform', 'Content design'],
		summary: 'A living online archive of 4,000 soil specimens, explored like a landscape.',
		highlight: 'landscape',
		intro:
			'Musée des Sols holds one of Europe’s largest collections of soil cores — and almost nobody had ever seen it. We turned the archive into a terrain you can walk through.',
		challenge:
			'Scientific data, no hero images, and an audience split between researchers and curious visitors. The archive had to stay rigorous for one and become irresistible for the other.',
		approach: [
			'Every specimen became a contour map generated from its real layer measurements, so the visual identity is literally the data.',
			'A single continuous WebGL terrain replaces the classic catalogue grid. Zooming in moves you from continent to core sample without a page load.',
			'A quiet editorial layer sits on top: long-form stories written with the curators, set like a field notebook.',
		],
		results: [
			{ value: '6:40', label: 'average session' },
			{ value: '×3.2', label: 'archive requests' },
			{ value: '2', label: 'design awards' },
		],
		visual: { kind: 'topo', seed: 11, bg: '#0f1511', line: '#b8c2a6', accent: '#c8f53c' },
	},
	{
		slug: 'nocturne',
		latin: 'Oenothera nocturna',
		locality: 'Grasse, FR',
		name: 'Nocturne',
		client: 'Maison Ombelle',
		year: 2025,
		category: 'Fragrance launch',
		services: ['Campaign site', 'E-commerce', '3D', 'Motion'],
		summary: 'A night-blooming fragrance, launched as a garden that only opens after dark.',
		highlight: 'after dark',
		intro:
			'Nocturne is a fragrance built around night-blooming flowers. Maison Ombelle wanted a launch that felt like the scent itself: slow, intimate and slightly strange.',
		challenge:
			'Selling a smell through a screen. Every perfume site relies on the same bottle shot; we needed a sensory equivalent that still converted.',
		approach: [
			'The site follows the visitor’s local time. Before sunset it is a closed bud; after dark the garden unfolds, petal by petal.',
			'Each note of the fragrance is a generative flower whose shape is derived from its molecular profile.',
			'Checkout lives inside the experience as a small floating window, never breaking the atmosphere.',
		],
		results: [
			{ value: '41%', label: 'night-time conversion uplift' },
			{ value: '9 days', label: 'to first sell-out' },
		],
		visual: { kind: 'bloom', seed: 7, bg: '#140e0f', line: '#e7c9b8', accent: '#f07a2a' },
	},
	{
		slug: 'strata',
		latin: 'Saxifraga strata',
		locality: 'Lyon, FR',
		name: 'Strata',
		client: 'Atelier Basalte',
		year: 2025,
		category: 'Identity & website',
		services: ['Brand identity', 'Web design', 'Development'],
		summary: 'An identity for an architecture practice, drawn from the geology of its sites.',
		highlight: 'geology',
		intro:
			'Atelier Basalte designs buildings that sit inside landscapes rather than on top of them. Their identity needed the same discipline.',
		challenge:
			'Architecture portfolios all look alike: big photos, thin grotesk, white space. The studio wanted to be recognised before a single building was shown.',
		approach: [
			'We surveyed the geological strata of their ten most important sites and turned them into a family of line patterns, one per project.',
			'The website reads like a cross-section: scrolling cuts deeper through layers of projects, texts and drawings.',
			'A strict typographic grid keeps the system calm enough to let the buildings speak.',
		],
		visual: { kind: 'strata', seed: 23, bg: '#111311', line: '#a9ada6', accent: '#d9d6cc' },
	},
	{
		slug: 'spore-index',
		latin: 'Mycena reticulata',
		locality: 'Zurich, CH',
		name: 'Spore Index',
		client: 'Mycelia Lab',
		year: 2024,
		category: 'Data platform',
		services: ['Product design', 'Data visualisation', 'Front-end'],
		summary: 'A research platform mapping fungal networks across 300 forest plots.',
		highlight: 'fungal networks',
		intro:
			'Mycelia Lab measures the underground fungal networks that connect trees. Spore Index is the platform where that research becomes readable.',
		challenge:
			'Millions of data points, invisible subjects and users ranging from field biologists to policy makers.',
		approach: [
			'We designed an interface language based on growth: data appears progressively, like a network spreading.',
			'Dense views use monospace tables and ASCII sparklines that stay legible on field laptops in poor light.',
			'A public layer turns each forest plot into a shareable, living portrait.',
		],
		results: [
			{ value: '300', label: 'forest plots mapped' },
			{ value: '12k', label: 'monthly researchers' },
		],
		visual: { kind: 'topo', seed: 42, bg: '#0d1214', line: '#9fb3b0', accent: '#c8f53c' },
	},
	{
		slug: 'halo',
		latin: 'Lithops lucida',
		locality: 'Antwerp, BE',
		name: 'Halo',
		client: 'Oréade',
		year: 2024,
		category: 'Product launch',
		services: ['Art direction', 'Microsite', 'Real-time 3D'],
		summary: 'A mineral skincare line, revealed through light passing through stone.',
		highlight: 'light',
		intro:
			'Oréade formulates skincare from mineral springs. For the Halo serum, the brand wanted a launch as precise and quiet as the product.',
		challenge:
			'A transparent product, a minimal brand and a very short launch window.',
		approach: [
			'We built a real-time scene where light passes through a slice of mineral; the visitor’s cursor moves the light source.',
			'Product information appears as small glass labels anchored to the object, like specimen notes.',
			'The whole experience weighs under 2 MB and runs on mid-range phones.',
		],
		results: [{ value: '1.8 MB', label: 'total page weight' }],
		visual: { kind: 'bloom', seed: 3, bg: '#101213', line: '#d6dbe0', accent: '#c8f53c' },
	},
];
