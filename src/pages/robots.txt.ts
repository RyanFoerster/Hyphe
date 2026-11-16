// Tout le site se visite ; le plan indique où sont les pages.
// (Si Cloudflare gère aussi un robots.txt, il ajoute ses lignes devant celles-ci.)
import type { APIRoute } from 'astro';
import { abs } from '../lib/seo';

export const GET: APIRoute = () =>
	new Response(`User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
