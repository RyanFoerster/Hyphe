/**
 * Le catalogue — le vocabulaire appliqué au reste du site.
 *
 * Aucun geste nouveau : masque depuis le sol pour le texte et les planches,
 * trait de plume pour les filets, stagger vertical pour les groupes. La
 * répétition est voulue — c'est elle qui donne l'impression d'une seule main.
 *
 * **Un déclencheur par section, pas un par élément.** Si chaque titre, chaque
 * filet et chaque planche avait le sien, une section entière partirait d'un
 * bloc à l'entrée dans le viewport : trois ou quatre choses en mouvement au
 * même instant, la règle de densité rompue. Regroupés, ils forment une seule
 * phrase échelonnée, et deux blocs au plus se croisent.
 *
 * Le hero est exclu : il appartient à la timeline d'entrée, jamais au scroll.
 */
import type ScrollTriggerType from 'gsap/ScrollTrigger';
import gsap from 'gsap';

import { scene } from './scene';
import { revelerFilet, revelerGroupe, revelerPlanche, revelerTexte, type Revelation } from './texte';
import { DECLENCHEMENT, STAGGER, duree, voixCourante, type Voix } from './tokens';

type Geste = 'texte' | 'titre' | 'filet' | 'planche' | 'groupe';

/**
 * Recette : combien de phrases sont réellement en train de se dire. C'est LA
 * mesure de la règle de densité — lire le DOM confondrait la libération d'un
 * masque avec un mouvement.
 */
export let phrasesEnCours: () => number = () => 0;

/**
 * Deux phrases en vol au maximum — la règle de densité, appliquée à la lettre.
 *
 * Ce qui dépasse n'est PAS mis en file : une phrase retardée resterait masquée
 * sous les yeux de quelqu'un qui la lit déjà, ce qui est pire que trois
 * mouvements. Elle est posée d'un coup, à son état final. Le cas ne se produit
 * qu'au défilement rapide — un lecteur qui lance la page d'un geste ne regarde
 * de toute façon pas les entrées.
 */
const EN_VOL_MAX = 2;

const construire = (el: HTMLElement, geste: Geste, voix: Voix): Revelation | null => {
  switch (geste) {
    /* Les titres de section restent découpés en LIGNES, pas en mots : à cette
       échelle un découpage par mots multiplie les morceaux sans rien ajouter,
       et le hero garde ainsi son geste à lui. */
    case 'titre':
      return revelerTexte(el, { voix, decoupe: 'lignes' });
    case 'texte':
      return revelerTexte(el, { voix, decoupe: 'bloc' });
    case 'filet':
      return revelerFilet(el, voix);
    case 'planche':
      return revelerPlanche(el, voix);
    /* Stagger vertical sur les enfants directs — jamais en cascade diagonale,
       même quand la grille en compte trois de front. */
    case 'groupe':
      return revelerGroupe([...el.children] as HTMLElement[], voix);
  }
};

export const monterCatalogue = (): (() => void) => {
  /* Les pages de service (mentions, confidentialité, 404) gardent le fondu de
     route CSS et rien d'autre. Comme `Eyebrow` et `SectionTitle` portent le
     geste à la source, il faut les écarter ici — sinon la double entrée qu'on
     vient d'éliminer revient par la porte des primitives partagées. */
  if (document.body.dataset.ecoMode === 'legal') return () => {};

  const voix = voixCourante();

  /* Une section = une phrase. On remonte au conteneur le plus proche qui en
     est un ; à défaut, l'élément forme sa propre phrase. */
  const sectionDe = (el: HTMLElement): Element =>
    el.closest('section, [data-bloc]') ?? el;

  const cibles = [...document.querySelectorAll<HTMLElement>('[data-reveler]')]
    .filter((el) => !el.closest('[data-hero-entree]'));

  const phrases = new Map<Element, HTMLElement[]>();
  for (const el of cibles) {
    const cle = sectionDe(el);
    const liste = phrases.get(cle);
    if (liste) liste.push(el);
    else phrases.set(cle, [el]);
  }

  const revelations: Revelation[] = [];
  const declencheurs: ScrollTriggerType[] = [];
  const timelines: gsap.core.Timeline[] = [];
  let enVol = 0;

  for (const [section, membres] of phrases) {
    /* Chaque phrase rend la main dès qu'elle est dite : découpes défaites,
       `will-change` retiré. Le laisser en place immobiliserait une couche de
       composition par élément révélé, sur toute la durée de la visite. */
    const siennes: Revelation[] = [];
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        enVol = Math.max(0, enVol - 1);
        for (const r of siennes) r.rendre();
      },
    });
    let pose = false;

    membres.forEach((el, i) => {
      const r = construire(el, (el.dataset.reveler ?? 'texte') as Geste, voix);
      if (!r) return;
      revelations.push(r);
      siennes.push(r);
      /* Stagger vertical, dans l'ordre du DOM — donc de la lecture. Jamais en
         cascade diagonale. */
      tl.add(r.timeline, duree(STAGGER.bloc, voix) * i);
      pose = true;
    });
    if (!pose) continue;
    timelines.push(tl);

    declencheurs.push(
      scene({
        trigger: section,
        /* L'élément est déjà en train d'être lu quand il finit d'apparaître.
           Une section déjà à l'écran au montage part immédiatement — c'est ce
           qui remplace le fondu de route au-dessus de la ligne de flottaison. */
        start: DECLENCHEMENT,
        once: true,
        onEnter: () => {
          if (enVol >= EN_VOL_MAX) {
            /* Trop de monde en l'air : celle-ci se pose sans jouer. */
            tl.progress(1, true);
            for (const r of siennes) r.rendre();
            return;
          }
          enVol++;
          tl.play();
        },
      }),
    );
  }

  phrasesEnCours = () => timelines.filter((t) => t.isActive()).length;

  return () => {
    phrasesEnCours = () => 0;
    for (const d of declencheurs) d.kill();
    for (const r of revelations) r.rendre();
  };
};
