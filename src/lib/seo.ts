// Ce que lisent les moteurs de recherche et les réseaux, sans rien changer à
// l'écran : titres, descriptions, images de partage, données structurées
// (JSON-LD, schema.org).
// Une règle : ne rien déclarer que le site ne dise pas, ou qui ne soit pas vrai.
// Pas d'adresse postale ni de téléphone (le studio n'en publie pas), pas d'avis,
// pas de client ; les projets fictifs (`concept`) sont dits tels quels, et les
// réseaux n'entrent dans `sameAs` qu'une fois de vrais profils renseignés.
import { projects, type Project } from '../data/projects';
import { site } from '../data/site';

/** Adresse complète d'un chemin du site (`/work/loum` → https://…/work/loum) */
export const abs = (path: string) => new URL(path, site.url).href;

// ---------- Titres, descriptions, images de partage ----------

/** Image de partage par défaut : la fleur du hero, 1200 × 630 (scripts/og-jobs.json) */
export const SHARE = { src: '/og/home.jpg', width: 1200, height: 630 };

export const projectTitle = (p: Project) => `${p.name} — ${p.category} by ${site.name}`;

/** Image de partage d'un projet : son hero en 1200 × 630 */
export const shareImageOf = (p: Project) => `/og/${p.slug}.jpg`;
export const shareAltOf = (p: Project) => `${p.name}, ${p.category.toLowerCase()}: ${p.tagline.toLowerCase()}`;

/** Texte alternatif de l'image de couverture d'un projet */
export const coverAlt = (p: Project) => (p.media ? `${p.name} ${p.category.toLowerCase()}, home page` : `${p.name}, key visual`);

// Les savoir-faire s'écrivent avec une capitale dans les fiches ; dans une
// phrase, seuls les noms propres et les sigles la gardent
const inSentence = (s: string) => (/^[A-Z][a-z-]+(\s|$)/.test(s) && !/^Keystatic/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** Description d'une fiche : le résumé, puis ce que l'on y a fait, en 160 signes au plus */
export function projectDescription(p: Project) {
	for (let n = p.services.length; n > 0; n--) {
		const text = `${p.summary} ${p.category} by ${site.name}: ${list(p.services.slice(0, n).map(inSentence))}.`;
		if (text.length <= 160) return text;
	}
	return p.summary;
}

// ---------- Données structurées ----------

const STUDIO = abs('/#studio');
const WEBSITE = abs('/#website');
const country = (code: string) => ({ '@type': 'Country', name: new Intl.DisplayNames('en', { type: 'region' }).of(code) });
// Un lien vers la racine d'un réseau n'est pas un profil
const profiles = site.socials.map((s) => s.href).filter((href) => new URL(href).pathname.length > 1);

/** Le studio. `full` (accueil) : avec ce qu'il fait et où il travaille */
export const studio = (full = false) => ({
	'@type': 'Organization',
	'@id': STUDIO,
	name: site.name,
	url: abs('/'),
	logo: { '@type': 'ImageObject', '@id': abs('/#logo'), url: abs('/icon-512.png'), width: 512, height: 512, caption: site.name },
	image: abs(SHARE.src),
	email: site.email,
	...(full && {
		description: site.description,
		slogan: site.tagline,
		foundingDate: String(site.since),
		// Le pays seulement : le studio ne publie pas d'adresse
		address: { '@type': 'PostalAddress', addressCountry: site.country },
		areaServed: site.markets.map(country),
		knowsAbout: site.services.map((s) => s.name),
		hasOfferCatalog: {
			'@type': 'OfferCatalog',
			name: 'What we do',
			itemListElement: site.services.map((s) => ({
				'@type': 'Offer',
				itemOffered: { '@type': 'Service', name: s.name, description: s.text, provider: { '@id': STUDIO } },
			})),
		},
	}),
	...(profiles.length > 0 && { sameAs: profiles }),
});

export const website = () => ({
	'@type': 'WebSite',
	'@id': WEBSITE,
	url: abs('/'),
	name: site.name,
	alternateName: 'Hyphe',
	description: site.description,
	inLanguage: 'en',
	publisher: { '@id': STUDIO },
});

interface Page {
	/** Chemin de la page (`/work/loum`) */
	path: string;
	title: string;
	description: string;
	image?: string;
	type?: 'WebPage' | 'CollectionPage' | 'AboutPage';
	/** Fil d'Ariane, de l'accueil à la page */
	trail?: { name: string; path: string }[];
	/** Ce dont parle la page (identifiant d'un autre nœud) */
	about?: string;
	mainEntity?: string;
}

/** La page, et son fil d'Ariane s'il y en a un */
export function webPage({ path, title, description, image = SHARE.src, type = 'WebPage', trail, about, mainEntity }: Page) {
	const url = abs(path);
	return [
		{
			'@type': type,
			'@id': `${url}#page`,
			url,
			name: title,
			description,
			inLanguage: 'en',
			isPartOf: { '@id': WEBSITE },
			primaryImageOfPage: { '@type': 'ImageObject', url: abs(image), width: SHARE.width, height: SHARE.height },
			...(about && { about: { '@id': about } }),
			...(mainEntity && { mainEntity: { '@id': mainEntity } }),
			...(trail && { breadcrumb: { '@id': `${url}#breadcrumb` } }),
		},
		...(trail
			? [
					{
						'@type': 'BreadcrumbList',
						'@id': `${url}#breadcrumb`,
						itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: abs(t.path) })),
					},
				]
			: []),
	];
}

/** Accueil : le studio en entier, le site, la page */
export const homeSchema = (title: string) => [
	studio(true),
	website(),
	...webPage({ path: '/', title, description: site.description, about: STUDIO }),
];

/** /work : la liste des projets */
export function workSchema(title: string, description: string) {
	const id = `${abs('/work')}#projects`;
	return [
		studio(),
		website(),
		...webPage({ path: '/work', title, description, type: 'CollectionPage', mainEntity: id, trail: [{ name: 'Home', path: '/' }, { name: 'Work', path: '/work' }] }),
		{
			'@type': 'ItemList',
			'@id': id,
			name: `Projects by ${site.name}`,
			numberOfItems: projects.length,
			itemListElement: projects.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: abs(`/work/${p.slug}`) })),
		},
	];
}

/** Une fiche projet : la page, son fil d'Ariane, et l'ouvrage */
export function projectSchema(p: Project) {
	const path = `/work/${p.slug}`;
	const id = `${abs(path)}#project`;
	return [
		studio(),
		website(),
		...webPage({
			path,
			title: projectTitle(p),
			description: projectDescription(p),
			image: shareImageOf(p),
			mainEntity: id,
			trail: [{ name: 'Home', path: '/' }, { name: 'Work', path: '/work' }, { name: p.name, path }],
		}),
		{
			'@type': 'CreativeWork',
			'@id': id,
			name: p.name,
			description: p.summary,
			url: abs(path),
			image: abs(shareImageOf(p)),
			genre: p.category,
			keywords: p.services.join(', '),
			creator: { '@id': STUDIO },
			// Fictif : une étude du studio, sans date de livraison ni site en ligne.
			// Réel : l'année, et l'adresse où l'ouvrage se visite.
			...(p.concept ? { creativeWorkStatus: 'Concept' } : { dateCreated: String(p.year), ...(p.url && { sameAs: `https://${p.url}` }) }),
		},
	];
}

/** Le bloc JSON-LD d'une page, prêt à être écrit dans un <script> */
export const jsonLd = (graph: object[]) =>
	JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
