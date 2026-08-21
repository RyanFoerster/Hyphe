import { racine, type Crumb } from '~/data/navigation';

/** Fil d'Ariane des pages profondes — le rail de gauche hors page d'accueil. */
export const crumbsFor = (segments: Crumb[]): Crumb[] => [racine, ...segments];

export const herbierCrumb: Crumb = { href: '/herbier', nat: 'Projets — herbier', tel: 'data.store' };

export const isActive = (pathname: string, prefixes: string[]): boolean =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
