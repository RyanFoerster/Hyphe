/**
 * L'entrée du hero — le premier mouvement du site, et le plus visible.
 *
 * **Une seule timeline, deux points d'entrée.** Le cas `loader` et le cas
 * `rapide` jouent exactement la même chose ; seul l'instant du départ diffère.
 * Il n'existe pas de seconde variante à maintenir.
 *
 * La soudure avec le handoff est le moment critique. Quand la dormance a été
 * vue, `eco:pret` part à l'instant précis où le point posé a rejoint la spore
 * et où le voile entame son fondu de 450 ms. La timeline démarre **à zéro** :
 * le sourcil monte pendant que le voile s'efface et que la spore finit de se
 * poser. C'est un chevauchement, pas une succession — aucune frame d'attente.
 *
 * La spore, elle, n'est jamais ré-animée : le loader l'a déjà placée, et sans
 * loader elle est simplement là. On ne rejoue pas ce qui est acquis.
 */
import gsap from 'gsap';

import { quandPret } from './pret';
import { revelerGroupe, revelerTexte, type Revelation } from './texte';
import { SOUFFLE_SANS_LOADER, voixCourante } from './tokens';

/**
 * Les départs, en secondes. Réglés pour que deux blocs au plus soient en
 * mouvement à un instant donné — la règle de densité, tenue au chronomètre.
 */
const SCENARIO = {
  sourcil: 0,
  titre: 0.15,
  ancre: 0.9,
  baseline: 1.4,
  actions: 1.95,
} as const;

export const monterHero = (): (() => void) => {
  const racine = document.querySelector<HTMLElement>('[data-hero-entree]');
  if (!racine) return () => {};

  const voix = voixCourante();
  const prise = (nom: string) => racine.querySelector<HTMLElement>(`[data-hero="${nom}"]`);

  /* La voix est lue une fois, à la construction. Basculer la loupe pendant
     l'entrée ne réécrit pas ce qui est déjà en route. */
  const parties: Array<[Revelation | null, number]> = [
    [revelerTexte(prise('sourcil'), { voix, decoupe: 'bloc' }), SCENARIO.sourcil],
    [revelerTexte(prise('titre'), { voix, decoupe: 'mots' }), SCENARIO.titre],
    [revelerTexte(prise('ancre'), { voix, decoupe: 'lignes' }), SCENARIO.ancre],
    [revelerTexte(prise('baseline'), { voix, decoupe: 'bloc' }), SCENARIO.baseline],
    [revelerGroupe([...racine.querySelectorAll<HTMLElement>('[data-hero="actions"] > *')], voix),
      SCENARIO.actions],
  ];

  const vivantes = parties.filter((p): p is [Revelation, number] => p[0] !== null);
  /* Le moteur est arrivé après la révélation : rien n'a été touché, rien à
     jouer. Le hero reste tel que le CSS l'a livré. */
  if (!vivantes.length) return () => {};

  let rendu = false;
  const rendre = () => {
    if (rendu) return;
    rendu = true;
    for (const [r] of vivantes) r.rendre();
  };

  const tl = gsap.timeline({ paused: true, onComplete: rendre });
  for (const [r, position] of vivantes) tl.add(r.timeline, position);

  let appel: gsap.core.Tween | null = null;
  quandPret((c) => {
    if (c.cas === 'instantane') {
      /* Veille déclenchée : tout est posé d'un coup. Personne n'attend deux fois. */
      tl.progress(1, true);
      rendre();
      return;
    }
    /* Le seul écart entre les deux cas tient dans cette ligne. */
    const souffle = c.cas === 'loader' ? 0 : SOUFFLE_SANS_LOADER;
    appel = souffle ? gsap.delayedCall(souffle, () => tl.play()) : (tl.play(), null);
  });

  return () => {
    appel?.kill();
    tl.kill();
    rendre();
  };
};
