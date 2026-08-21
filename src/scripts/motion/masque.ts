/**
 * Les masques — le seul endroit du site qui a le droit de cacher quelque chose.
 *
 * Règle unique, et elle ne souffre pas d'exception : **le moteur ne masque
 * jamais un élément déjà révélé.** Le CSS livre tout visible ; c'est GSAP qui
 * masque, et seulement s'il est arrivé avant que le visiteur ne voie la page.
 *
 * L'autorisation est figée **une fois**, au démarrage du moteur, et jamais
 * relue ensuite : sans ça, un moteur arrivé une milliseconde avant le signal
 * se ferait couper au milieu de sa préparation et laisserait la moitié des
 * éléments masqués.
 */
import gsap from 'gsap';

import { peutMasquer, quandPret } from './pret';

/** Ce qu'on a effectivement masqué — pour pouvoir tout rendre d'un coup. */
const masques = new Set<Element>();
let autorise = false;
let fige = false;

/**
 * Fige la porte. Appelé une seule fois, au tout début du moteur, avant le
 * moindre `gsap.set`.
 */
export const figerAutorisation = (): void => {
  if (fige) return;
  fige = true;
  autorise = peutMasquer();

  /* Veille déclenchée : plus aucune entrée ne jouera. On libère ce qu'on venait
     de préparer ET on referme la porte — sans quoi un module montant plus tard
     (une navigation, une section) masquerait de nouveau dans un site déjà posé. */
  quandPret((c) => {
    if (c.cas !== 'instantane') return;
    autorise = false;
    liberer();
  });
};

/** Le moteur est-il arrivé à temps pour préparer une entrée ? */
export const masquageAutorise = (): boolean => autorise;

/**
 * Prépare une entrée en masquant. Ne fait rien — et le dit — si le contenu est
 * déjà à l'écran : l'appelant se contente alors d'accrocher ses ScrollTrigger.
 *
 * @returns vrai si le masque a été posé, donc si une entrée doit suivre.
 */
export const preparer = (cibles: gsap.TweenTarget, etat: gsap.TweenVars): boolean => {
  if (!autorise) return false;
  const els = gsap.utils.toArray<Element>(cibles);
  if (!els.length) return false;
  gsap.set(els, etat);
  for (const el of els) masques.add(el);
  return true;
};

/** Un masque a joué son entrée : il n'est plus à libérer en urgence. */
export const oublier = (cibles: gsap.TweenTarget): void => {
  for (const el of gsap.utils.toArray<Element>(cibles)) masques.delete(el);
};

/** Tout rendre visible immédiatement, sans transition. */
export const liberer = (): void => {
  if (!masques.size) return;
  gsap.set([...masques], { clearProps: 'all' });
  masques.clear();
};

/** Recette : combien d'éléments sont actuellement masqués par le moteur. */
export const compterMasques = (): number => masques.size;
