// Coordonnées et réseaux : valeurs provisoires, à remplacer.
export const site = {
	name: 'Studio Hyphe',
	url: 'https://hyphe.ryanfoerster.dev',
	tagline: 'Digital experiences, grown differently.',
	description:
		'Studio Hyphe is a digital experience studio. We design and build websites, interfaces and interactive worlds for brands that want to be felt, not just seen.',
	email: 'hello@studiohyphe.com',
	city: 'Belgium',
	/** Code court de l'horloge */
	cityCode: 'BE',
	timezone: 'Europe/Brussels',
	socials: [
		{ label: 'Instagram', href: 'https://instagram.com/' },
		{ label: 'LinkedIn', href: 'https://linkedin.com/' },
	],
	/** Ce que l'on fait pousser : un pétale de la corolle par savoir-faire */
	services: [
		{ name: 'Art direction', text: 'A visual language that grows from the idea, not from a trend.', items: ['Concept', 'Moodboards', 'Visual identity'] },
		{ name: 'Web design', text: 'Interfaces drawn to be felt: rhythm, type and motion together.', items: ['UX & flows', 'UI design', 'Prototypes'] },
		{ name: 'Creative development', text: 'Hand-built front-ends where every transition is crafted.', items: ['Astro & React', 'Animation', 'Performance'] },
		{ name: 'WebGL & 3D', text: 'Real-time worlds and specimens that live in the browser.', items: ['Three.js', 'Shaders', 'Generative'] },
		{ name: 'Interactive installations', text: 'Screens, sensors and spaces that answer to people.', items: ['Exhibitions', 'Events', 'Touch & motion'] },
		{ name: 'Design systems', text: 'Living libraries that keep a brand coherent as it grows.', items: ['Tokens', 'Components', 'Documentation'] },
	],
};
