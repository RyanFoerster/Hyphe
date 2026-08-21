export const site = {
  nom: 'studio Hyphe',
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
