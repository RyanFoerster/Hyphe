/**
 * Les scènes — création et destruction disciplinées des ScrollTrigger.
 *
 * Le layout est persistant : à chaque échange de vue, les déclencheurs de la
 * page sortante doivent mourir, ceux du layout et de l'organisme survivre.
 * D'où deux portées explicites plutôt qu'un `ScrollTrigger.killAll()` qui
 * emporterait tout.
 *
 * Rien ici ne crée d'animation : c'est le registre, pas le catalogue.
 */
import ScrollTrigger from 'gsap/ScrollTrigger';

/** Déclencheurs appartenant à la page en cours — tués à la navigation. */
const page: ScrollTrigger[] = [];
/** Déclencheurs du layout et de l'organisme — ils traversent les navigations. */
const durables: ScrollTrigger[] = [];

/** Un déclencheur de page. Meurt avec elle. */
export const scene = (vars: ScrollTrigger.StaticVars): ScrollTrigger => {
  const st = ScrollTrigger.create(vars);
  page.push(st);
  return st;
};

/** Un déclencheur de layout. Survit aux navigations, à créer une seule fois. */
export const sceneDurable = (vars: ScrollTrigger.StaticVars): ScrollTrigger => {
  const st = ScrollTrigger.create(vars);
  durables.push(st);
  return st;
};

/** Tue les déclencheurs de la page sortante, et eux seuls. */
export const viderScenes = (): void => {
  for (const st of page) st.kill();
  page.length = 0;
};

/**
 * Comptage pour la recette : si `page` ne revient pas à son étiage après une
 * navigation, c'est qu'un déclencheur fuit.
 */
export const compterScenes = (): { page: number; durables: number; total: number } => {
  /* `once: true` fait mourir un déclencheur après son passage : il reste dans
     nos tableaux mais n'observe plus rien. On ne compte que les vivants, sinon
     la recette lit une fuite là où il n'y a qu'un travail fini. */
  const vivant = (st: ScrollTrigger) => ScrollTrigger.getAll().includes(st);
  return {
    page: page.filter(vivant).length,
    durables: durables.filter(vivant).length,
    total: ScrollTrigger.getAll().length,
  };
};

/**
 * Recalcule les positions. À appeler quand les métriques ont pu bouger :
 * typographies posées, planches chargées, page montée.
 *
 * Le redimensionnement, lui, n'est pas branché ici : ScrollTrigger écoute déjà
 * `resize` et débounce son propre rafraîchissement. En ajouter un second ferait
 * le travail deux fois, pas mieux.
 */
export const rafraichir = (): void => ScrollTrigger.refresh();

/** Rafraîchit une fois que les planches visibles ont fini d'arriver. */
export const rafraichirApresImages = (racine: ParentNode = document): void => {
  const images = [...racine.querySelectorAll('img')].filter((img) => !img.complete);
  if (!images.length) return;

  let restantes = images.length;
  let differe = 0;
  const compter = () => {
    if (--restantes > 0) return;
    /* Une seule passe à la fin, pas une par image. */
    clearTimeout(differe);
    differe = window.setTimeout(rafraichir, 60);
  };
  for (const img of images) {
    img.addEventListener('load', compter, { once: true });
    img.addEventListener('error', compter, { once: true });
  }
};
