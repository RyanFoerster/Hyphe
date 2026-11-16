// Coordonnées et réseaux : valeurs provisoires, à remplacer.
export const site = {
	name: 'Studio Hyphe',
	url: 'https://studiohyphe.com',
	tagline: 'We grow websites people remember.',
	/** Ce que lisent les moteurs de recherche et les cartes de partage (rien de
	    tout cela ne s'affiche dans la page) : titre de l'accueil, description par
	    défaut, texte de l'image de partage */
	seoTitle: 'Studio Hyphe — Creative web design & WebGL studio in Belgium',
	description:
		'Studio Hyphe is a creative web studio in Belgium. We design and build custom websites, web apps and WebGL experiences by hand, for brands that want to be felt.',
	shareAlt: 'Studio Hyphe: a translucent flower grown in code, above the words “We grow websites people remember.”',
	/** Année de naissance du studio (le « Since » du loader) */
	since: 2026,
	/** Pays du studio et pays démarchés (codes ISO), pour les données structurées */
	country: 'BE',
	markets: ['BE', 'FR'],
	email: 'hello@studiohyphe.com',
	city: 'Belgium',
	/** Code court de l'horloge */
	cityCode: 'BE',
	timezone: 'Europe/Brussels',
	/** Tant qu'un lien pointe sur la racine d'un réseau (pas encore de profil),
	    il n'entre pas dans les données structurées (`sameAs`, voir lib/seo.ts) */
	socials: [
		{ label: 'Instagram', href: 'https://www.instagram.com/studio.hyphe/' },
		{ label: 'LinkedIn', href: 'https://linkedin.com/' },
	],
	/** Ce que l'on fait pousser : un pétale de la corolle par savoir-faire */
	services: [
		{ name: 'Art direction', text: 'We find the look and the tone that fit you, not this year’s trend.', items: ['Concept', 'Moodboards', 'Visual identity'] },
		{ name: 'Web design', text: 'Pages that are a pleasure to read, to scroll and to use.', items: ['UX & flows', 'UI design', 'Prototypes'] },
		{ name: 'Creative development', text: 'We write the code ourselves, so every detail moves the way it should.', items: ['Astro & React', 'Animation', 'Performance'] },
		{ name: 'WebGL & 3D', text: 'Worlds in 3D that run right in the browser, like the flower above.', items: ['Three.js', 'Shaders', 'Generative'] },
		{ name: 'Interactive installations', text: 'Screens and spaces that react when people come close.', items: ['Exhibitions', 'Events', 'Touch & motion'] },
		{ name: 'Site redesigns', text: 'Your site has aged. We rebuild it so it looks like the work you do today.', items: ['Audit', 'New structure', 'Migration'] },
	],
};
