import type { APIRoute } from 'astro';

import { site } from '~/data/site';

/**
 * robots.txt — généré plutôt que posé dans `public/`, parce que son contenu
 * dépend de `site.indexable` : porte fermée sur le sous-domaine d'attente,
 * ouverte et sitemap annoncé sur le domaine définitif.
 */
export const GET: APIRoute = () => {
  const corps = site.indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site.url).href}\n`
    : `# Domaine d'attente — rien à indexer ici.\nUser-agent: *\nDisallow: /\n`;

  return new Response(corps, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
