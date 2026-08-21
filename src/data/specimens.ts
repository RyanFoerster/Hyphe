import type { Specimen } from '~/types/content';

import planche01 from '~/assets/plates/specimen-01.jpg';
import planche02 from '~/assets/plates/specimen-02.jpg';
import planche03 from '~/assets/plates/specimen-03.jpg';
import planche04 from '~/assets/plates/specimen-04.jpg';

/**
 * Un enregistrement par spécimen collecté.
 * Les placeholders [entre crochets] attendent le contenu réel.
 * Planches : gravures de Haeckel (domaine public) en attendant les visuels projet.
 */
export const specimens: Specimen[] = [
  {
    slug: 'specimen-01',
    num: '01',
    nom: '[Spécimen 01 — nom du projet]',
    latin: 'Projectus primus',
    client: '[client]',
    collecte: '[Liège, mars 2025]',
    mission: 'design + dev',
    techs: ['Next.js', 'PostgreSQL'],
    statut: 'stable',
    livrable: { label: 'Site e-commerce', famille: 'site' },
    resume: '[Une phrase : le problème que ce projet résout.]',
    stack: '[Next.js · PostgreSQL]',
    prod: '[04/2025]',
    uptime: '[99,96 %]',
    bundle: '[142 ko]',
    lighthouse: '[98]',
    ttfb: '[120 ms]',
    requetes: '[18]',
    cout: '[12 €/mois]',
    planche: planche01,
    noteNat:
      'Un site e-commerce pour [client]. [Ensuite, le brief côté humain : qui sont les utilisateurs, ce qui coinçait, ce qu’on a décidé de dessiner et pourquoi. 3-4 phrases concrètes, zéro jargon.]',
    noteTel:
      '[Le cahier des charges technique : contraintes d’hébergement, volumétrie, intégrations imposées, budget perf. Même longueur, même franchise.]',
    pigments: [{ hex: '#D4A24C' }, { hex: '#6B8F4E' }, { hex: '#E8E4D9' }, { hex: '#1A2119' }],
    typo: '[Fraunces — titres · JetBrains Mono — données]',
    espacement: '[échelle 4/8, gouttières 32]',
    morpho: [
      { nat: '[écran clé nº 1 — ce qu’il fallait résoudre]', tel: 'route / — SSR, 24 ko' },
      { nat: '[parcours principal, trois étapes]', tel: 'api.checkout — 3 endpoints' },
      { nat: '[état vide dessiné avant l’état plein]', tel: 'db: 7 tables, 2 vues' },
      { nat: '[annotation de marge, crayon]', tel: 'worker.cron — nightly' },
    ],
    rejets: [
      '[Piste A abandonnée — pourquoi elle séduisait, pourquoi on l’a jetée.]',
      '[Piste B abandonnée — une ligne, honnête.]',
      '[Piste C abandonnée — gardée en marge, plus pâle.]',
    ],
    migrations: [
      '[2025-05 — incident : ce qui a cassé, en prod, un vendredi.]',
      '[2025-07 — refacto : ce qu’on a réécrit et ce que ça a coûté.]',
      '[2025-09 — migration de version majeure, sans interruption.]',
    ],
    resultats: [
      { valeur: '[+38 %]', label: '[conversion]' },
      { valeur: '[−54 %]', label: '[temps de traitement]' },
      { valeur: '[×3]', label: '[trafic organique]' },
    ],
    temoignage: {
      texte: '[Citation client courte, deux phrases maximum.]',
      nom: '[Prénom Nom]',
      fonction: '[fonction, entreprise]',
      ts: '2025-11-04 09:12',
    },
  },
  {
    slug: 'specimen-02',
    num: '02',
    nom: '[Spécimen 02 — nom du projet]',
    latin: 'Projectus secundus',
    client: '[client]',
    collecte: '[Namur, juin 2025]',
    mission: 'design + dev',
    techs: ['React', 'Node', 'Redis'],
    statut: 'croissance',
    livrable: { label: 'Application SaaS', famille: 'app' },
    resume: '[Une phrase : le problème que ce projet résout.]',
    stack: '[React · Node · Redis]',
    prod: '[07/2025]',
    uptime: '[99,91 %]',
    bundle: '[188 ko]',
    lighthouse: '[95]',
    ttfb: '[140 ms]',
    requetes: '[24]',
    cout: '[19 €/mois]',
    planche: planche02,
    noteNat: 'Une application SaaS de réservation pour [client]. [Le brief côté humain — 3-4 phrases.]',
    noteTel: '[Les contraintes système — 3-4 phrases.]',
    pigments: [{ hex: '#E0507E' }, { hex: '#A8B89A' }, { hex: '#0E1410' }, { hex: '#E8E4D9' }],
    typo: '[à documenter]',
    espacement: '[à documenter]',
    morpho: [
      { nat: '[écran clé nº 1]', tel: 'route /app — SPA, lazy' },
      { nat: '[parcours de réservation]', tel: 'api.booking — 5 endpoints' },
      { nat: '[écran d’erreur soigné]', tel: 'queue: Redis, 2 workers' },
      { nat: '[annotation de marge]', tel: 'ws.live — 240 conn.' },
    ],
    rejets: ['[Piste A abandonnée.]', '[Piste B abandonnée.]', '[Piste C abandonnée.]'],
    migrations: ['[incident nº 1.]', '[refacto nº 1.]', '[migration nº 1.]'],
    resultats: [
      { valeur: '[−70 %]', label: '[no-shows]' },
      { valeur: '[+2,4×]', label: '[réservations]' },
      { valeur: '[4,8/5]', label: '[satisfaction]' },
    ],
    temoignage: {
      texte: '[Citation client courte.]',
      nom: '[Prénom Nom]',
      fonction: '[fonction, entreprise]',
      ts: '2025-12-18 14:03',
    },
  },
  {
    slug: 'specimen-03',
    num: '03',
    nom: '[Spécimen 03 — nom du projet]',
    latin: 'Projectus tertius',
    client: '[client]',
    collecte: '[Bruxelles, sept. 2025]',
    mission: 'dev',
    techs: ['Vue', 'FastAPI', 'PostgreSQL'],
    statut: 'stable',
    livrable: { label: 'App métier', famille: 'app' },
    resume: '[Une phrase : le problème que ce projet résout.]',
    stack: '[Vue · FastAPI · Postgres]',
    prod: '[10/2025]',
    uptime: '[99,99 %]',
    bundle: '[96 ko]',
    lighthouse: '[100]',
    ttfb: '[85 ms]',
    requetes: '[12]',
    cout: '[8 €/mois]',
    planche: planche03,
    noteNat: 'Une application de gestion pour [client]. [Le brief côté humain — 3-4 phrases.]',
    noteTel: '[Les contraintes système — 3-4 phrases.]',
    pigments: [{ hex: '#6B8F4E' }, { hex: '#42592E' }, { hex: '#D4A24C' }, { hex: '#E8E4D9' }],
    typo: '[à documenter]',
    espacement: '[à documenter]',
    morpho: [
      { nat: '[tableau de bord principal]', tel: 'route /board — SSR + îlots' },
      { nat: '[flux d’import des données]', tel: 'etl.import — 40k lignes/j' },
      { nat: '[vue de synthèse imprimable]', tel: 'pdf.render — 300 ms' },
      { nat: '[annotation de marge]', tel: 'auth: SSO interne' },
    ],
    rejets: ['[Piste A abandonnée.]', '[Piste B abandonnée.]', '[Piste C abandonnée.]'],
    migrations: ['[incident nº 1.]', '[refacto nº 1.]', '[migration nº 1.]'],
    resultats: [
      { valeur: '[−12 h]', label: '[par semaine, saisie]' },
      { valeur: '[0]', label: '[erreurs de report]' },
      { valeur: '[100]', label: '[Lighthouse]' },
    ],
    temoignage: {
      texte: '[Citation client courte.]',
      nom: '[Prénom Nom]',
      fonction: '[fonction, entreprise]',
      ts: '2026-01-22 11:47',
    },
  },
  {
    slug: 'specimen-04',
    num: '04',
    nom: '[Spécimen 04 — nom du projet]',
    latin: 'Projectus quartus',
    client: '[client]',
    collecte: '[Liège, déc. 2025]',
    mission: 'design',
    techs: ['Astro', 'CMS headless'],
    statut: 'dormance',
    livrable: { label: 'Site vitrine', famille: 'site' },
    resume: '[Une phrase : le problème que ce projet résout.]',
    stack: '[Astro · CMS headless]',
    prod: '[01/2026]',
    uptime: '[99,95 %]',
    bundle: '[64 ko]',
    lighthouse: '[99]',
    ttfb: '[95 ms]',
    requetes: '[9]',
    cout: '[5 €/mois]',
    planche: planche04,
    noteNat: 'Un site vitrine avec billetterie pour [client]. [Le brief côté humain — 3-4 phrases.]',
    noteTel: '[Les contraintes système — 3-4 phrases.]',
    pigments: [{ hex: '#A8B89A' }, { hex: '#E0507E' }, { hex: '#1C2614' }, { hex: '#E8E4D9' }],
    typo: '[à documenter]',
    espacement: '[à documenter]',
    morpho: [
      { nat: '[page d’accueil, saison haute]', tel: 'route / — statique, edge' },
      { nat: '[agenda et billetterie]', tel: 'api.tickets — webhook' },
      { nat: '[gabarit d’article]', tel: 'cms: 6 modèles de contenu' },
      { nat: '[annotation de marge]', tel: 'img.cdn — AVIF auto' },
    ],
    rejets: ['[Piste A abandonnée.]', '[Piste B abandonnée.]', '[Piste C abandonnée.]'],
    migrations: ['[incident nº 1.]', '[refacto nº 1.]', '[migration nº 1.]'],
    resultats: [
      { valeur: '[×2,1]', label: '[billets en ligne]' },
      { valeur: '[−80 %]', label: '[poids des pages]' },
      { valeur: '[+41 %]', label: '[abonnés newsletter]' },
    ],
    temoignage: {
      texte: '[Citation client courte.]',
      nom: '[Prénom Nom]',
      fonction: '[fonction, entreprise]',
      ts: '2026-03-02 16:30',
    },
  },
];

export const getSpecimen = (slug: string): Specimen | undefined =>
  specimens.find((s) => s.slug === slug);

/** Le spécimen suivant dans la collection, en boucle. */
export const nextSpecimen = (slug: string): Specimen => {
  const i = specimens.findIndex((s) => s.slug === slug);
  return specimens[(i + 1) % specimens.length]!;
};

export const allTechs = [...new Set(specimens.flatMap((s) => s.techs))];
export const allMissions = [...new Set(specimens.map((s) => s.mission))];

export const statutColor: Record<string, string> = {
  stable: 'var(--color-tele-green)',
  croissance: 'var(--color-tele-cyan)',
  dormance: 'var(--color-spore)',
};
