/**
 * La révélation par masque — la signature du site.
 *
 * Tout ce qui apparaît pousse depuis le sol, sous un masque, jamais par un
 * fondu seul et jamais par un côté. Deux voix, un seul squelette :
 *
 *  · NATURALISTE — la ligne monte lentement et se redresse, et l'encre prend
 *    sur le papier dans les 200 dernières millisecondes : le texte arrive un
 *    peu pâle et gagne sa densité en se posant.
 *  · TÉLÉMÉTRIE — la ligne arrive nette, d'un bloc, avec un surlignage très
 *    bref qui s'éteint. Un rendu de terminal.
 *
 * Les lignes se chevauchent : la suivante part avant que la précédente ne soit
 * posée. C'est ce chevauchement qui sépare « propre » de « vivant ».
 *
 * Le corps de texte est découpé en LIGNES, les grands titres en MOTS. Jamais
 * en caractères : c'est le tic le plus daté du genre.
 */
import gsap from 'gsap';
import SplitText from 'gsap/SplitText';

import { easeApparition, SETTLE, TRACE } from './eases';
import { oublier, peutPreparer, preparer } from './masque';
import { DUREE, REDRESSEMENT, STAGGER, duree, type Voix } from './tokens';

/** Le surlignage de télémétrie, éteint. */
const SURLIGNE = 'rgba(77,240,208,0.11)';

/**
 * Un masque épouse la boîte de ligne, qui ne contient pas les jambages : sur
 * un display de 150 px, le « y » de Hyphe se retrouve tranché. On descend donc
 * le bord du masque d'un quart de cadratin, et on reprend la même valeur en
 * marge négative — la clôture s'agrandit, la mise en page ne bouge pas.
 */
const GARDE_JAMBAGE = '0.22em';

const degagerJambages = (morceaux: HTMLElement[]): void => {
  for (const m of morceaux) {
    const masque = m.parentElement;
    if (!masque) continue;
    masque.style.paddingBottom = GARDE_JAMBAGE;
    masque.style.marginBottom = `-${GARDE_JAMBAGE}`;
  }
};

export interface Revelation {
  /** La sous-timeline à poser dans la timeline maîtresse. */
  timeline: gsap.core.Timeline;
  /** Rend le DOM à son état d'origine : plus de découpe, plus de style. */
  rendre(): void;
}

/** Enveloppe un élément dans un masque à débordement caché. */
const enmasquer = (el: HTMLElement): (() => void) => {
  const masque = document.createElement('span');
  /* Clip vertical seulement : une puce posée en marge négative (annotations du
     manifesto) ne doit pas être tranchée par le masque. Et aucun style propre —
     le masque est une fenêtre, pas un décor. */
  masque.style.cssText =
    `display:block;overflow:clip;overflow-x:visible;padding-bottom:${GARDE_JAMBAGE};margin-bottom:-${GARDE_JAMBAGE};`;
  el.parentNode?.insertBefore(masque, el);
  masque.appendChild(el);
  return () => {
    masque.parentNode?.insertBefore(el, masque);
    masque.remove();
  };
};

/**
 * L'état de départ, sous le masque. La voix ne change que la densité — et
 * l'encre ne pâlit que si elle a le droit de monter : au retour, le texte
 * arrive à sa densité finale, le geste du premier contact ne se répète pas.
 */
const depart = (voix: Voix, encre: boolean): gsap.TweenVars => ({
  yPercent: 100,
  rotate: voix === 'tel' ? REDRESSEMENT.rotation * 0.4 : REDRESSEMENT.rotation,
  transformOrigin: '0% 100%',
  opacity: voix === 'nat' && encre ? REDRESSEMENT.encreDepart : 1,
  ...(voix === 'tel' ? { backgroundColor: SURLIGNE } : {}),
});

/**
 * Colmate un état préparé : descend chaque morceau du dépassement qui reste
 * visible dans la fenêtre de son masque.
 *
 * `yPercent: 100` descend l'élément de SA hauteur — mais la fenêtre du masque
 * est plus haute que lui : la garde des jambages (padding-bottom), et pour un
 * bloc enveloppé, ses propres marges. Mesuré : 3 à 19 px de texte restaient
 * visibles à l'état préparé — l'échafaudage exposé. Un élément non révélé doit
 * être VISUELLEMENT ABSENT ; l'espace, lui, reste réservé (le masque garde sa
 * hauteur, rien ne bouge dans le flux).
 */
const colmater = (morceaux: HTMLElement[]): void => {
  for (const el of morceaux) {
    const masque = el.parentElement;
    if (!masque) continue;
    const fuite = masque.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
    if (fuite > 0.1) gsap.set(el, { y: fuite + 0.75 });
  }
};

/**
 * `will-change` se pose au démarrage du geste, jamais à la préparation.
 *
 * Un élément préparé peut attendre longtemps sous la ligne de flottaison — si
 * le visiteur ne descend pas, il attend toute la visite. Le poser dès la
 * préparation immobiliserait une couche de composition par élément en attente,
 * ce qui est exactement ce qu'on cherche à éviter. Il est retiré par
 * `rendre()`, avec le reste.
 */
const armer = (cibles: gsap.TweenTarget) => () => gsap.set(cibles, { willChange: 'transform' });

/**
 * Prépare une révélation. Retourne `null` si le moteur est arrivé trop tard —
 * l'appelant n'a alors rien à jouer, et rien n'a été touché.
 */
export const revelerTexte = (
  cible: Element | null,
  { voix, decoupe = 'lignes', encre = true }:
    { voix: Voix; decoupe?: 'lignes' | 'mots' | 'bloc'; encre?: boolean },
): Revelation | null => {
  /* La porte se consulte AVANT de toucher au DOM : découper une page déjà lue
     provoquerait un reflux visible pour rien. */
  if (!cible || !peutPreparer(cible)) return null;

  const morceaux: HTMLElement[] = [];
  const defaire: Array<() => void> = [];

  if (decoupe === 'bloc') {
    const el = cible as HTMLElement;
    defaire.push(enmasquer(el));
    morceaux.push(el);
  } else {
    const mots = decoupe === 'mots';
    const split = SplitText.create(cible, {
      type: mots ? 'words' : 'lines',
      /* GSAP pose lui-même le conteneur à débordement caché par ligne. */
      mask: mots ? 'words' : 'lines',
      /* La sémantique est préservée : `aria-label` sur le conteneur, morceaux
         masqués aux lecteurs d'écran. Le texte reste lu d'une seule voix. */
      aria: 'auto',
      linesClass: 'ligne-revelee',
      wordsClass: 'mot-revele',
    });
    morceaux.push(...((mots ? split.words : split.lines) as HTMLElement[]));
    degagerJambages(morceaux);
    defaire.push(() => split.revert());
  }

  if (!morceaux.length || !preparer(morceaux, depart(voix, encre))) {
    for (const undo of defaire) undo();
    return null;
  }
  colmater(morceaux);

  /* Le stagger suit la voix comme la durée : un seul squelette temporel,
     joué 25 % plus vite en télémétrie — pas un squelette à deux vitesses. */
  const ecart = duree(decoupe === 'mots' ? STAGGER.mot : STAGGER.ligne, voix);
  const d = duree(decoupe === 'mots' ? DUREE.mot : DUREE.ligne, voix);
  const tl = gsap.timeline({ onStart: armer(morceaux) });

  tl.to(morceaux, {
    yPercent: 0,
    y: 0,
    rotate: 0,
    duration: d,
    ease: easeApparition(voix),
    stagger: ecart,
  }, 0);

  if (voix === 'nat' && encre) {
    /* La montée d'encre : elle rattrape la fin de la course, pas son début. */
    tl.to(morceaux, {
      opacity: 1,
      duration: DUREE.encre,
      ease: SETTLE,
      stagger: ecart,
    }, Math.max(0, d - DUREE.encre));
  } else if (voix === 'tel') {
    /* Le surlignage s'éteint presque aussitôt — une trace, pas un effet. */
    tl.to(morceaux, {
      backgroundColor: 'rgba(77,240,208,0)',
      duration: duree(0.26, voix),
      ease: SETTLE,
      stagger: ecart,
    }, 0.04);
  }

  return {
    timeline: tl,
    rendre() {
      /* `will-change` ne survit jamais à l'animation : il est retiré avec tout
         le reste, et la découpe est défaite — le DOM redevient celui du HTML.
         Le registre des masques les oublie : ils sont sur le point d'être
         détachés, et rien ne doit plus tenter de les libérer. */
      oublier(morceaux);
      gsap.set(morceaux, { clearProps: 'all' });
      for (const undo of defaire) undo();
    },
  };
};

/**
 * Une poussée simple, pour ce qui n'est pas du texte (boutons, mentions) :
 * même vocabulaire, sans découpe ni masque — un groupe qui monte et prend.
 */
export const revelerGroupe = (
  cibles: Element[],
  voix: Voix,
): Revelation | null => {
  if (!cibles.length || !preparer(cibles, { y: 18, opacity: 0 })) return null;
  const tl = gsap.timeline({ onStart: armer(cibles) });
  tl.to(cibles, {
    y: 0,
    opacity: 1,
    duration: duree(DUREE.ligne, voix),
    ease: easeApparition(voix),
    stagger: duree(STAGGER.carte, voix),
  }, 0);
  return {
    timeline: tl,
    rendre: () => {
      oublier(cibles);
      gsap.set(cibles, { clearProps: 'all' });
    },
  };
};

/**
 * Un filet se trace, d'un bord à l'autre — un trait de plume, pas un fondu.
 * L'origine est à gauche : le trait part d'où commence la lecture.
 */
export const revelerFilet = (cible: Element | null, voix: Voix): Revelation | null => {
  if (!cible) return null;
  /* Le trait part d'où commence la lecture : de gauche pour un filet couché,
     du haut pour un rail dressé (annotations de marge). Même geste, deux
     orientations — décidées par la forme de l'élément, pas par un réglage. */
  const r = cible.getBoundingClientRect();
  const vertical = r.height > r.width;
  const depart = vertical
    ? { scaleY: 0, transformOrigin: '50% 0%' }
    : { scaleX: 0, transformOrigin: '0% 50%' };
  if (!preparer(cible, depart)) return null;
  const tl = gsap.timeline({ onStart: armer(cible) });
  tl.to(cible, {
    ...(vertical ? { scaleY: 1 } : { scaleX: 1 }),
    duration: duree(vertical ? DUREE.filet * 1.6 : DUREE.filet, voix),
    ease: TRACE,
  }, 0);
  return {
    timeline: tl,
    rendre: () => {
      oublier(cible);
      gsap.set(cible, { clearProps: 'all' });
    },
  };
};

/**
 * Une planche se lève depuis le bas de son cadre, avec un très léger
 * recentrage interne (1,06 → 1) : sans lui, l'image donne l'impression d'une
 * vitre qu'on fait coulisser plutôt que d'une matière qui se pose.
 *
 * Le cadre porte déjà `overflow:hidden` — c'est lui le masque, on n'en ajoute
 * pas un second.
 */
export const revelerPlanche = (cadre: Element | null, voix: Voix): Revelation | null => {
  if (!cadre) return null;
  const el = cadre as HTMLElement;
  const image = el.querySelector<HTMLElement>('.plate-img, img');
  /* Le CADRE entier se lève — fond, bordure, légende et image d'un seul
     tenant : un cadre teinté qui attend son image est de l'échafaudage, et un
     élément non révélé doit être visuellement absent. Le masque est le nôtre,
     l'`overflow:hidden` du cadre ne servant qu'à son image interne. */
  const defaire = enmasquer(el);
  if (!preparer(el, { yPercent: 100 })) {
    defaire();
    return null;
  }
  colmater([el]);
  /* Le léger recentrage interne (1,06 → 1) reste : sans lui, la planche est
     une vitre qu'on fait coulisser, pas une matière qui se pose. */
  if (image) gsap.set(image, { scale: 1.06 });
  const tl = gsap.timeline({ onStart: armer(el) });
  tl.to(el, {
    yPercent: 0,
    y: 0,
    duration: duree(DUREE.masque, voix),
    ease: easeApparition(voix),
  }, 0);
  if (image) {
    tl.to(image, {
      scale: 1,
      duration: duree(DUREE.masque, voix) * 1.15,
      ease: SETTLE,
    }, 0);
  }
  return {
    timeline: tl,
    rendre: () => {
      oublier(el);
      gsap.set(el, { clearProps: 'all' });
      if (image) gsap.set(image, { clearProps: 'scale' });
      defaire();
    },
  };
};
