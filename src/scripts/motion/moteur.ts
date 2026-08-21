/**
 * Le moteur — GSAP, ses plugins et Lenis. **Chargé en différé.**
 *
 * Ce module est le seul à importer le paquet d'animation, et il n'est jamais
 * importé statiquement : `motion/index.ts` va le chercher après le premier
 * paint. Tout ce qui est vital (l'organisme, la dormance, le signal `eco:pret`)
 * vit sans lui. S'il arrive tard, le site est déjà lisible et déjà révélé ;
 * il ne fait que rendre le mouvement possible.
 */
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SplitText from 'gsap/SplitText';
import CustomEase from 'gsap/CustomEase';
import Lenis from 'lenis';
/* `html.lenis{height:auto}` et les gardes `data-lenis-prevent` : sans cette
   feuille, un conteneur défilant interne renvoie son geste à la page. */
import 'lenis/dist/lenis.css';

import { cederLeBattement } from './battement';
import { figerAutorisation } from './masque';
import { monterHero } from './hero';
export { casHero } from './hero';
import { enregistrerEases } from './eases';
import { quandPret } from './pret';
import { rafraichir, rafraichirApresImages, viderScenes } from './scene';

/* Recette : ce qui compte vit derrière le moteur, jamais devant — importer
   `scene.ts` ou `masque.ts` depuis le paquet de départ y ferait retomber GSAP. */
export { compterScenes, scene, sceneDurable } from './scene';
export { compterMasques, liberer, masquageAutorise, oublier, preparer } from './masque';

/** Recette : ralentit tout le mouvement du site, pour filmer une entrée. */
export const ralentir = (facteur: number): void => {
  gsap.globalTimeline.timeScale(facteur);
};

let lenis: Lenis | null = null;

/** Le défilement adouci, s'il est en service (jamais en mouvement réduit). */
export const defilement = (): Lenis | null => lenis;

export const demarrerMoteur = (): void => {
  /* Tout premier geste, avant le moindre `gsap.set` : le moteur décide une
     fois pour toutes s'il est arrivé à temps pour masquer quoi que ce soit.
     Sur cache chaud sans loader, le signal peut l'avoir précédé. */
  figerAutorisation();

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  enregistrerEases();

  /* Un onglet en arrière-plan rend des deltas énormes au retour. On plafonne
     plutôt que de laisser les timelines sauter d'un bloc. */
  gsap.ticker.lagSmoothing(500, 33);

  /* Le battement du site passe sur le ticker : notre rAF s'éteint au même
     instant. Il n'y a jamais deux boucles, ni avant ni après. */
  cederLeBattement(gsap.ticker);

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    lenis = new Lenis({
      /* Le point capital : Lenis ne bat pas de son côté, c'est le ticker qui
         l'avance. Un second rAF parallèle est la cause classique du jank
         qu'on ne sait pas expliquer. */
      autoRaf: false,
      duration: 1.05,
      gestureOrientation: 'vertical',
      /* Un conteneur défilant sous le pointeur garde son geste : les schémas
         d'architecture des fiches spécimen défilent chez eux, pas dans la
         page. Lenis le détecte seul — inutile d'étiqueter chaque bloc. */
      allowNestedScroll: true,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((temps) => lenis?.raf(temps * 1000));
  }

  /* Les positions ne valent rien tant que les typographies ne sont pas posées :
     Fraunces est variable et change les hauteurs de ligne en arrivant. */
  const recaler = () => {
    quandPret(() => {
      document.fonts.ready.then(() => {
        rafraichir();
        rafraichirApresImages();
      });
    });
  };
  recaler();

  /* ── Les entrées de page ── */
  let demonterHero: (() => void) | null = null;
  const monterPage = () => {
    demonterHero?.();
    /* Le hero est au-dessus de la ligne de flottaison : il appartient à la
       timeline d'entrée et n'aura jamais de ScrollTrigger d'apparition. */
    demonterHero = monterHero();
  };
  monterPage();

  /* ── Navigation ── */
  document.addEventListener('astro:before-swap', viderScenes);
  document.addEventListener('astro:page-load', () => {
    /* Le layout est persistant : Lenis garde les métriques de la page
       précédente tant qu'on ne le lui dit pas. */
    lenis?.resize();
    monterPage();
    recaler();
  });
};
