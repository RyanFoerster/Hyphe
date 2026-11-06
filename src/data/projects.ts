// Projets FICTIFS servant à construire le système. Clients, chiffres et
// textes sont inventés : à remplacer par les vrais projets du studio.
// Les noms passent en Parceh : lettres, espaces, virgules et points seulement.

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
}

export const projects: Project[] = [
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
		locality: 'Brussels, BE',
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
