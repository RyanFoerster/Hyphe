export const site = {
  nom: 'studio Hyphe',
  /**
   * Domaine servi. Source unique : `astro.config.mjs` en tire `site:` (donc les
   * canoniques et le sitemap), et `robots.txt.ts` s'en sert pour l'annonce.
   */
  url: 'https://hyphe.ryanfoerster.dev',
  /**
   * Faux tant qu'on est sur un sous-domaine d'attente : le site se retire des
   * moteurs. Sinon la version provisoire s'indexe, puis se met en concurrence
   * avec le domaine définitif — deux adresses pour le même contenu. À passer à
   * `true` le jour du vrai domaine, et rien d'autre à toucher.
   */
  indexable: false,
  baseline: {
    nat: 'On fait pousser des trucs.',
    tel: 'On maintient des systèmes vivants.',
  },
  station: 'Liège, Belgique',
  coords: '50.6326 N, 5.5797 E',
  email: 'hello@studiohyphe.be',
  /** Biomasse maximale accumulable pendant une visite (unités arbitraires). */
  biomasseMax: 12437,
} as const;

export const mailto = `mailto:${site.email}`;
