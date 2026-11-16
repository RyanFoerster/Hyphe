// Le plan du site, écrit à la main : les pages sont peu nombreuses et l'on sait
// exactement lesquelles existent. Les adresses sont celles que l'on sert (sans
// `.html` ni barre finale), les mêmes que les liens canoniques. Pas de date de
// modification : on n'en connaît pas de fiable, et une date fausse dessert.
import type { APIRoute } from 'astro';
import { projects } from '../data/projects';
import { abs } from '../lib/seo';

export const GET: APIRoute = () => {
	const paths = ['/', '/work', ...projects.map((p) => `/work/${p.slug}`)];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `\t<url><loc>${abs(path)}</loc></url>`).join('\n')}
</urlset>
`;
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
