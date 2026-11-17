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
	/** Crédits dus pour ce que montrent les images de la fiche (photos sous licence libre, par exemple) */
	credits?: string;
	/** Vrais médias. Sans eux, les visuels sont générés (lib/generative). */
	media?: {
		/** Image 16:9 des cartes, spécimens et partages */
		cover: string;
		/** Vidéo 16:9 du hero, avec son image d'attente : la grande vidéo du projet. Elle sert aussi de
		 *  couverture sur la page des projets et ouvre les planches de la fiche, juste après le hero (platesOf). */
		heroVideo?: string;
		heroPoster?: string;
		/** Légende de cette vidéo quand elle ouvre les planches */
		heroCaption?: string;
		/** Le film du projet (teaser, showreel), quand il existe : 16:9, muet à l'écran. Il prend la
		 *  première planche à la place de la vidéo du hero. */
		reel?: { src: string; poster: string; caption: string };
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

/** Les planches d'un projet, dans l'ordre de la page. La première, juste après le hero, est
 *  toujours le projet en mouvement : son film s'il en a un (`reel`), sinon la vidéo du hero. */
export function platesOf(p: Project): Plate[] {
	if (p.media) {
		const { gallery, heroVideo, heroPoster, heroCaption, reel } = p.media;
		const film: Plate | null = reel
			? { src: reel.src, ratio: '16/9', caption: reel.caption, kind: 'video', poster: reel.poster }
			: heroVideo
				? { src: heroVideo, ratio: '16/9', caption: heroCaption ?? 'motion, the website, live', kind: 'video', poster: heroPoster }
				: null;
		return film ? [film, ...gallery] : gallery;
	}
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
			// Le teaser de lancement du site (monté par Ryan dans loumv2/video, réencodé ici en 1600 × 900, sans son)
			reel: { src: '/work/loum/teaser.mp4', poster: '/work/loum/teaser-poster.webp', caption: 'film, the launch teaser' },
			gallery: [
				{ src: '/work/loum/home-drag.webp', ratio: '16/9', caption: 'index, the contact sheet' },
				{ src: '/work/loum/m-home.webp', ratio: '4/5', caption: 'mobile, index' },
				{ src: '/work/loum/m-drag.webp', ratio: '4/5', caption: 'mobile, dragging the sheet' },
				{ src: '/work/loum/project.webp', ratio: '16/9', caption: 'project page, Biche', kind: 'browser' },
				{ src: '/work/loum/m-project.webp', ratio: '4/5', caption: 'mobile, project' },
				{ src: '/work/loum/m-scroll.webp', ratio: '4/5', caption: 'mobile, figures' },
				{ src: '/work/loum/m-lire.webp', ratio: '4/5', caption: 'mobile, project file' },
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
			'Everything is illustrated in SVG, in risograph inks: a generated cover for each farm, forty-four fruits and vegetables for the seasonal calendar, grain and misprinted colour plates done with filters and masks.',
		],
		results: [
			{ value: '44', label: 'seasonal illustrations, all SVG' },
			{ value: '23', label: 'farms on the prototype map' },
			{ value: '57', label: 'Belgian communes in the search' },
		],
		visual: { kind: 'bloom', seed: 11, bg: '#fcfaf2', line: '#352200', accent: '#f07a2a' },
		url: 'farmlize.studiohyphe.com',
		media: {
			cover: '/work/farmlize/home.webp',
			heroVideo: '/work/farmlize/home.mp4',
			heroPoster: '/work/farmlize/home-poster.webp',
			heroCaption: 'motion, the home page comes alive',
			// Sept planches fixes, composées à partir du site en ligne (pages, composants
			// isolés, illustrations) : sources et pièces dans cases/farmlize, hors git
			gallery: [
				{ src: '/work/farmlize/pages.webp', ratio: '16/9', caption: 'the pages, home, explorer and the three steps' },
				{ src: '/work/farmlize/m-pages.webp', ratio: '4/5', caption: 'mobile, the screens' },
				{ src: '/work/farmlize/pieces.webp', ratio: '4/5', caption: 'components, a handful' },
				{ src: '/work/farmlize/scenes.webp', ratio: '4/5', caption: 'illustrations, the six scenes' },
				{ src: '/work/farmlize/farm-pieces.webp', ratio: '16/9', caption: 'components, a farm page in pieces' },
				{ src: '/work/farmlize/produce.webp', ratio: '16/9', caption: 'illustrations, produce, seasons and farm covers' },
				{ src: '/work/farmlize/pages-2.webp', ratio: '16/9', caption: 'the pages, farm, seasons, onboarding, producers' },
			],
		},
	},
	{
		// Belgium 2018, The Road to Glory : un projet du studio, pas une commande (pas de
		// client à inventer). Le nom s'écrit sans « 2018 » : Parceh n'a pas de chiffres.
		// Tout ce qui est chiffré ici se vérifie dans le code du projet (EditoBelgique).
		slug: 'belgium-2018',
		tagline: 'Seven matches, one summer',
		locality: 'Belgium',
		name: 'Road to Glory',
		client: 'Ourselves',
		year: 2026,
		category: 'Editorial story',
		services: ['Art direction', 'Editorial design', 'Illustration', 'Creative development'],
		summary: 'Belgium at the 2018 World Cup, told as a scrolling fanzine of stickers, tickets and cut paper.',
		highlight: 'fanzine',
		intro:
			'Russia, summer 2018. Belgium play seven matches, win six and come home third. Nobody asked us for this one: we made it for ourselves, to keep that month the way supporters do, in a box of stickers, tickets and newspaper cuttings. It became an unofficial fanzine you read by scrolling.',
		challenge:
			'Tell seven matches without a second of match footage, make free photographs from Wikimedia Commons look like they were printed for the same fanzine, and hold a reader through more than sixty screens of scrolling.',
		approach: [
			'Eight chapters, from the dream to third place. Every match has its ticket, which turns over to show the goals, and two goals are replayed step by step on a drawn pitch: Chadli against Japan in six steps, De Bruyne against Brazil in three.',
			'Everything that looks printed is drawn in code: fifteen sticker shapes, fourteen doodles, the tickets, the flags and the newspapers. A seeded random sets every tilt and every cut, so the page is the same on each visit.',
			'The photographs come from Wikimedia Commons, under free licences. The browser redraws each one as a screen print in the colours of the fanzine, and each is credited at the end of the story.',
			'The scroll engine is our own, with no animation library: sections pinned in CSS and three kinds of motion, one that follows the scroll, one that plays once, one that snaps from state to state.',
		],
		results: [
			{ value: '8', label: 'chapters for seven matches' },
			{ value: '75', label: 'objects pinned on the last wall' },
			{ value: '15', label: 'sticker shapes, drawn in code' },
		],
		visual: { kind: 'strata', seed: 18, bg: '#f5f3ee', line: '#080808', accent: '#e52b32' },
		url: 'roadtoglory.studiohyphe.com',
		// Les photos visibles dans les images et les vidéos de la fiche (27, relevées vue par
		// vue : cases/belgium/credits.json) : quatre photographes et un ministère
		credits:
			'Photographs seen in these images: Kirill Venediktov, Svetlana Beketova, Dmitry Sadovnikov and Edgar Breshchanov / soccer.ru (CC BY-SA 3.0) and the Ministry of Sport of the Republic of Tatarstan (CC BY 4.0), from Wikimedia Commons, reprinted in one or two inks by the site. Each one is credited at the end of the story.',
		media: {
			cover: '/work/belgium-2018/home.webp',
			heroVideo: '/work/belgium-2018/home.mp4',
			heroPoster: '/work/belgium-2018/home-poster.webp',
			heroCaption: 'motion, the poster opens on chapter one',
			// Sept planches fixes et trois courtes boucles, composées à partir du site en ligne
			// (pages, composants isolés, dessins) : sources et pièces dans cases/belgium, hors git
			gallery: [
				{ src: '/work/belgium-2018/pages.webp', ratio: '16/9', caption: 'the pages, the poster, Japan and four minutes' },
				{ src: '/work/belgium-2018/m-pages.webp', ratio: '4/5', caption: 'mobile, the screens' },
				{ src: '/work/belgium-2018/stickers.webp', ratio: '4/5', caption: 'components, forty stickers' },
				{ src: '/work/belgium-2018/tickets.webp', ratio: '4/5', caption: 'components, the seven tickets' },
				{ src: '/work/belgium-2018/scroll.mp4', ratio: '16/9', caption: 'motion, the Japan chapter scrolls sideways', kind: 'video', poster: '/work/belgium-2018/scroll-poster.webp' },
				{ src: '/work/belgium-2018/doodles.webp', ratio: '16/9', caption: 'illustrations, doodles, scores and pencil marks' },
				{ src: '/work/belgium-2018/board.webp', ratio: '16/9', caption: 'components, a goal replay in pieces' },
				{ src: '/work/belgium-2018/replay.mp4', ratio: '16/9', caption: 'motion, the scroll replays a goal', kind: 'video', poster: '/work/belgium-2018/replay-poster.webp' },
				{ src: '/work/belgium-2018/pages-2.webp', ratio: '16/9', caption: 'the pages, four more screens' },
				{ src: '/work/belgium-2018/stickers.mp4', ratio: '16/9', caption: 'motion, the squad lands sticker by sticker', kind: 'video', poster: '/work/belgium-2018/stickers-poster.webp' },
			],
		},
	},
];
