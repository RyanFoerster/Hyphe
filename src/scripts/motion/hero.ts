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

import { contextePret, quandPret, type Cas } from './pret';
import { revelerGroupe, revelerTexte, type Revelation } from './texte';
import { RETOUR_FACTEUR, duree, voixCourante } from './tokens';

/**
 * Les départs, en secondes, exprimés dans la voix naturaliste — ils passent
 * par `duree()` comme tout le reste. Sans quoi la télémétrie raccourcirait ses
 * gestes sans resserrer son scénario : des blocs plus vifs séparés par les
 * mêmes silences, ce qui n'est plus la même voix mais un hybride.
 *
 * Réglés pour que deux blocs au plus soient en mouvement à un instant donné —
 * la règle de densité, tenue au chronomètre.
 */
const SCENARIO = {
  sourcil: 0,
  titre: 0.15,
  ancre: 0.9,
  baseline: 1.4,
  actions: 1.95,
} as const;

/**
 * L'entrée a-t-elle déjà eu lieu dans cette fenêtre ? Portée fenêtre, pas
 * portée page : une navigation interne conserve ce module, un rechargement dur
 * en crée un neuf. Le visiteur qui recharge revient vraiment, celui qui navigue
 * ne fait que repasser — même règle que la dormance.
 */
let dejaEntre = false;

/** Recette : le cas effectivement joué par le hero, `retour` compris. */
export let casHero: Cas | null = null;

export const monterHero = (): (() => void) => {
  const racine = document.querySelector<HTMLElement>('[data-hero-entree]');
  if (!racine) return () => {};

  const voix = voixCourante();
  /* Deux chemins mènent au retour : une navigation interne (ce module a déjà
     joué), ou une dormance sautée — le cache chaud dit que le visiteur a déjà
     vu le site dans cette session. */
  const retour = dejaEntre || contextePret().cas === 'retour';
  const prise = (nom: string) => racine.querySelector<HTMLElement>(`[data-hero="${nom}"]`);

  /* La voix est lue une fois, à la construction. Basculer la loupe pendant
     l'entrée ne réécrit pas ce qui est déjà en route. */
  /* Au retour, l'encre ne remonte pas : c'est le geste du premier contact. */
  const encre = !retour;
  const a = (t: number) => duree(t, voix);
  const parties: Array<[Revelation | null, number]> = [
    [revelerTexte(prise('sourcil'), { voix, decoupe: 'bloc', encre }), a(SCENARIO.sourcil)],
    [revelerTexte(prise('titre'), { voix, decoupe: 'mots', encre }), a(SCENARIO.titre)],
    [revelerTexte(prise('ancre'), { voix, decoupe: 'lignes', encre }), a(SCENARIO.ancre)],
    [revelerTexte(prise('baseline'), { voix, decoupe: 'bloc', encre }), a(SCENARIO.baseline)],
    [revelerGroupe([...racine.querySelectorAll<HTMLElement>('[data-hero="actions"] > *')], voix),
      a(SCENARIO.actions)],
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

  /* Un retour se POSE, il ne pousse pas : la même timeline, resserrée d'un
     seul facteur — durées et staggers ensemble, donc le rapport entre les
     blocs ne bouge pas. Il n'existe toujours qu'une timeline. */
  if (retour) tl.timeScale(RETOUR_FACTEUR);

  quandPret((c) => {
    const cas: Cas = retour ? 'retour' : c.cas;
    casHero = cas;
    if (cas === 'instantane') {
      /* Veille déclenchée : tout est posé d'un coup. Personne n'attend deux fois. */
      tl.progress(1, true);
      rendre();
      return;
    }
    dejaEntre = true;
    /* Plus aucun délai : l'entrée doit chevaucher la pose de la spore, jamais
       lui succéder — et un retour n'a rien à attendre non plus. */
    tl.play();
  });

  return () => {
    tl.kill();
    rendre();
  };
};
