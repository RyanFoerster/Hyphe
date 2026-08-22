/**
 * Les masques — le seul endroit du site qui a le droit de cacher quelque chose.
 *
 * Règle unique, et elle ne souffre pas d'exception : **le moteur ne masque
 * jamais un élément que le visiteur a déjà vu.** Le CSS livre tout visible ;
 * c'est GSAP qui masque, et seulement ce qui n'a pas encore été montré.
 *
 * La décision se prend PAR ÉLÉMENT, au moment de le préparer. Une porte
 * globale figée au démarrage du moteur — la première version — fermait tout
 * le catalogue dès que le moteur perdait la course contre `eco:pret` : sur
 * cache chaud en réseau réel, les sections du bas de page, que personne
 * n'avait jamais vues, restaient statiques pour toute la visite. Un élément
 * est masquable si l'une de ces choses est vraie :
 *
 *  · le contenu n'a pas encore été révélé (`eco:pret` pas passé) ;
 *  · on est dans l'échange de vue du routeur — le DOM vient d'être remplacé,
 *    rien n'en a été peint ;
 *  · l'élément est entièrement SOUS le bas de l'écran — jamais vu.
 *
 * Seul verrou définitif : le cas `instantane` (veille ou mouvement réduit).
 * Plus aucun masque ensuite, y compris pour ce qui arriverait plus tard.
 */
import gsap from 'gsap';

import { estRevele, quandPret } from './pret';

/** Ce qu'on a effectivement masqué — pour pouvoir tout rendre d'un coup. */
const masques = new Set<Element>();
let verrouille = false;
/** Fenêtre d'échange de vue : le nouveau DOM n'a pas encore été peint. */
let enEchange = false;
let branche = false;

/** Branche les écouteurs de la porte. Appelé une fois, au début du moteur. */
export const figerAutorisation = (): void => {
  if (branche) return;
  branche = true;

  /* Veille déclenchée : plus aucune entrée ne jouera. On libère ce qui était
     préparé ET on verrouille — un module montant plus tard ne masquera pas
     dans un site déjà posé. */
  quandPret((c) => {
    if (c.cas !== 'instantane') return;
    verrouille = true;
    liberer();
  });

  document.addEventListener('astro:before-swap', () => {
    enEchange = true;
  });
  document.addEventListener('astro:page-load', () => {
    /* Les montages de page se font dans les écouteurs de `astro:page-load`,
       de façon synchrone : deux frames plus tard, tout est monté et peint —
       la fenêtre se referme. */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      enEchange = false;
    }));
  });
};

/** Cet élément peut-il encore être caché sans rien reprendre au visiteur ? */
const masquable = (el: Element): boolean => {
  if (verrouille) return false;
  if (!estRevele() || enEchange) return true;
  /* Jamais vu : entièrement sous le bas de l'écran au moment de la décision. */
  return el.getBoundingClientRect().top >= innerHeight - 1;
};

/** Recette : la porte est-elle encore ouverte, au moins en principe ? */
export const masquageAutorise = (): boolean => !verrouille;

/**
 * Pré-vérification pour qui doit transformer le DOM avant de masquer (la
 * découpe en lignes) : inutile de découper ce que `preparer` refusera.
 */
export const peutPreparer = (el: Element): boolean => masquable(el);

/**
 * Prépare une entrée en masquant. Ne fait rien — et le dit — si l'un des
 * éléments a déjà été vu : une phrase se masque en bloc ou pas du tout,
 * jamais à moitié. L'appelant se contente alors de ne pas animer.
 *
 * @returns vrai si le masque a été posé, donc si une entrée doit suivre.
 */
export const preparer = (cibles: gsap.TweenTarget, etat: gsap.TweenVars): boolean => {
  const els = gsap.utils.toArray<Element>(cibles);
  if (!els.length || !els.every(masquable)) return false;
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
