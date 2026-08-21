import type { Saison } from '~/types/content';

export const saisons: Saison[] = [
  {
    nat: 'Germination',
    tel: 'discovery',
    color: 'var(--color-nat-400)',
    desc: 'On écoute, on creuse, on comprend le terrain avant de planter quoi que ce soit.',
  },
  {
    nat: 'Croissance',
    tel: 'design',
    color: 'var(--color-nat-500)',
    desc: 'Maquettes, prototypes, itérations. La forme se ramifie jusqu’à tenir debout.',
  },
  {
    nat: 'Floraison',
    tel: 'build',
    color: 'var(--color-bloom)',
    desc: 'Le code prend le relais. Ce qui était dessiné se met à vivre pour de vrai.',
  },
  {
    nat: 'Pollinisation',
    tel: 'mise en prod',
    color: 'var(--color-spore)',
    desc: 'Mise en ligne, mesures, soins. Puis le cycle recommence — un projet vivant ne s’arrête pas.',
  },
];

/** Les quatre cardinaux de la roue des saisons (section « Saisons »). */
export const cycle = [
  { label: 'Germination', color: 'var(--color-nat-300)', pos: 'top' },
  { label: 'Croissance', color: 'var(--color-nat-300)', pos: 'right' },
  { label: 'Floraison', color: 'var(--color-bloom)', pos: 'bottom' },
  { label: 'Pollinisation', color: 'var(--color-spore)', pos: 'left' },
] as const;
