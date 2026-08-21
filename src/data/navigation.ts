import type { NavLink, Stade } from '~/types/content';

/**
 * Double étiquetage : le littéral en tête, le poétique en second — jamais
 * l'inverse. Sur mobile, seul le littéral survit (géré par SiteHeader).
 */
export const navLinks: NavLink[] = [
  { href: '/herbier', lit: 'Projets', poetique: "l'Herbier", tel: 'data.store', match: ['/herbier'] },
  { href: '/#symbiose', lit: 'Le duo', poetique: 'les Espèces', tel: 'proc.duplex', match: ['/espece'] },
  { href: '/pollinisation', lit: 'Contact', poetique: 'Pollinisation', tel: 'net.broadcast', match: ['/pollinisation'] },
];

/**
 * Les sept stades de l'organisme — le rail de gauche sur la page d'accueil.
 * Même règle : le nom commun d'abord, le stade en second.
 */
export const stades: Stade[] = [
  { id: 'spore', nat: 'Accueil · I spore', tel: 'sys.boot' },
  { id: 'germination', nat: 'Manifesto · II germination', tel: 'init' },
  { id: 'cultures', nat: 'Offres · III cultures', tel: 'svc.catalog' },
  { id: 'symbiose', nat: 'Le duo · IV symbiose', tel: 'link.duplex' },
  { id: 'specimens', nat: 'Projets · V spécimens', tel: 'data.store' },
  { id: 'saisons', nat: 'Méthode · VI saisons', tel: 'cron.cycle' },
  { id: 'pollinisation', nat: 'Devis · VII pollinisation', tel: 'net.broadcast' },
];

export interface Crumb {
  href: string;
  nat: string;
  tel: string;
}

export const racine: Crumb = { href: '/', nat: 'Accueil — terrain', tel: 'root' };
