// Coordonnées et réseaux : valeurs provisoires, à remplacer.
export const site = {
	name: 'Studio Hyphe',
	url: 'https://studiohyphe.com',
	tagline: 'We grow websites people remember.',
	description:
		'Studio Hyphe is a small studio from Belgium. We design and build websites, apps and interactive worlds by hand, for brands that want to be felt, not just seen.',
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
		{ name: 'Art direction', text: 'We find the look and the tone that fit you, not this year’s trend.', items: ['Concept', 'Moodboards', 'Visual identity'] },
		{ name: 'Web design', text: 'Pages that are a pleasure to read, to scroll and to use.', items: ['UX & flows', 'UI design', 'Prototypes'] },
		{ name: 'Creative development', text: 'We write the code ourselves, so every detail moves the way it should.', items: ['Astro & React', 'Animation', 'Performance'] },
		{ name: 'WebGL & 3D', text: 'Worlds in 3D that run right in the browser, like the flower above.', items: ['Three.js', 'Shaders', 'Generative'] },
		{ name: 'Interactive installations', text: 'Screens and spaces that react when people come close.', items: ['Exhibitions', 'Events', 'Touch & motion'] },
		{ name: 'Design systems', text: 'A tidy kit of parts, so your brand stays itself as it grows.', items: ['Tokens', 'Components', 'Documentation'] },
	],
};
