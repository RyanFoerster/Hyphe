import type { Offre } from '~/types/content';

/**
 * Ce qu'on cultive — les trois offres du studio, présentées comme des
 * variétés. Le titre littéral est la première lecture ; la nomenclature
 * poétique est l'annotation. Délais : placeholders à affiner.
 */
export const offres: Offre[] = [
  {
    id: 'sites',
    titre: 'Sites web',
    poetique: 'Floraison annuelle',
    tel: 'svc.web',
    detail: 'Vitrines, e-commerce, portfolios',
    phrase:
      'Pour les PME et les indépendants qui veulent être trouvés et convaincre : un site rapide, soigné, facile à faire vivre.',
    delai: '[4–8 semaines]',
    stacks: 'Astro · Next.js · CMS headless',
    href: '/herbier?livrable=site',
  },
  {
    id: 'apps',
    titre: 'Applications web',
    poetique: 'Culture pérenne',
    tel: 'svc.app',
    detail: 'SaaS, outils métier, tableaux de bord',
    phrase:
      'Pour automatiser un process ou lancer un produit : une application sur mesure, maintenue en production après la mise en ligne.',
    delai: '[2–4 mois]',
    stacks: 'React · Node · PostgreSQL',
    href: '/herbier?livrable=app',
  },
  {
    id: 'design',
    titre: 'Design UX/UI',
    poetique: 'Greffe et hybridation',
    tel: 'svc.design',
    detail: 'Identité, interfaces, design systems',
    phrase:
      'Pour clarifier un produit existant ou partir sur des bases saines : recherche utilisateur, maquettes, système de composants.',
    stacks: 'Figma · design tokens',
    href: '/herbier?mission=design',
  },
];
