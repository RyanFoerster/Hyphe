import type { Espece, EspeceSlug } from '~/types/content';

export const especes: Record<EspeceSlug, Espece> = {
  designer: {
    slug: 'designer',
    strate: 'canopée',
    eyebrow: 'Spécimen A — étage supérieur · canopée',
    nom: '[Prénom Nom — designer UX/UI]',
    latin: 'Designator canopeae',
    annee: '(Lg., 2019)',
    role: 'La moitié design du studio : recherche utilisateur, interfaces et design systems, pour des sites web et des applications.',
    habitat: 'Liège — lumière directe, café filtre',
    regime: 'Figma, design systems, typographie, recherche utilisateur',
    comportement: 'Réorganise les interfaces d’autrui. Défend la veuve, l’orphelin et l’interlignage.',
    activite: 'Diurne. Floraison en début de projet.',
    dispo: '[disponible à partir de mai 2026]',
    inventaire: [
      'Figma — relevés quotidiens',
      'Design tokens — semis en pépinière',
      'Prototypage — floraisons rapides',
      'Recherche utilisateur — observation en milieu naturel',
      'Typographie — taille et greffe',
    ],
    competences: [
      { nom: 'UX / recherche', niveau: 88, tel: 'ux.research' },
      { nom: 'UI / systèmes', niveau: 92, tel: 'ui.systems' },
      { nom: 'Prototypage', niveau: 85, tel: 'proto.fast' },
      { nom: 'Accessibilité', niveau: 78, tel: 'a11y.aa' },
    ],
    frise: [
      { annee: '[2019]', nat: 'germination — premières missions en solo', tel: 'init — freelance' },
      { annee: '[2021]', nat: 'croissance — studios et scale-ups', tel: 'scale — [clients notables]' },
      {
        annee: '[2023]',
        nat: 'floraison — rencontre de l’autre moitié de l’organisme',
        tel: 'link.duplex établi',
      },
      {
        annee: '[2026]',
        nat: 'pollinisation — studio Hyphe, station de Liège',
        tel: 'broadcast — station Liège',
      },
    ],
    specimens: ['specimen-01', 'specimen-02', 'specimen-04'],
    autre: 'dev',
  },
  dev: {
    slug: 'dev',
    strate: 'rhizosphère',
    eyebrow: 'Spécimen B — sous-sol · rhizosphère',
    nom: '[Prénom Nom — développeur fullstack]',
    latin: 'Developator rhizomorphus',
    annee: '(Lg., 2017)',
    role: 'La moitié développement du studio : le code, les données et la mise en production des sites web et des applications.',
    habitat: 'Liège — pénombre, deux écrans, thé froid oublié',
    regime: 'TypeScript, React, Node, PostgreSQL, CI qui passe du premier coup',
    comportement: 'Invisible en surface. Toute la page repose pourtant sur lui.',
    activite: 'Crépusculaire. Pics d’activité nocturnes documentés.',
    dispo: '[disponible à partir d’avril 2026]',
    inventaire: [
      'TypeScript — langue vernaculaire',
      'PostgreSQL — sous-sol nourricier',
      'Node / React — tuteurs de croissance',
      'CI/CD — irrigation automatique',
      'Monitoring — pièges photographiques',
    ],
    competences: [
      { nom: 'Backend / API', niveau: 93, tel: 'api.core' },
      { nom: 'Frontend', niveau: 84, tel: 'front.react' },
      { nom: 'Infra / déploiement', niveau: 88, tel: 'infra.deploy' },
      { nom: 'Données', niveau: 86, tel: 'db.postgres' },
    ],
    frise: [
      { annee: '[2017]', nat: 'germination — premières racines en agence', tel: 'init — agence' },
      { annee: '[2020]', nat: 'croissance — produits en production, la nuit', tel: 'scale — [produits]' },
      { annee: '[2023]', nat: 'floraison — symbiose avec la canopée', tel: 'link.duplex établi' },
      {
        annee: '[2026]',
        nat: 'pollinisation — studio Hyphe, station de Liège',
        tel: 'broadcast — station Liège',
      },
    ],
    specimens: ['specimen-01', 'specimen-02', 'specimen-03'],
    autre: 'designer',
  },
};

export const especeList = Object.values(especes);

/** Accent propre à chaque espèce : ocre pour la canopée, cyan pour la rhizosphère. */
export const especeAccent = (slug: EspeceSlug): string =>
  slug === 'dev' ? 'var(--color-tele-cyan)' : 'var(--color-spore)';

/** Halo télémétrique : la canopée reçoit la lumière par le haut, le rhizome par le bas. */
export const especeHalo = (slug: EspeceSlug): string =>
  slug === 'dev'
    ? 'radial-gradient(ellipse 90% 50% at 50% 100%, rgb(77 240 208 / 0.05), transparent 70%)'
    : 'radial-gradient(ellipse 90% 50% at 50% 0%, rgb(212 162 76 / 0.06), transparent 70%)';
