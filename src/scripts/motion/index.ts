/**
 * Le socle du mouvement — un seul battement pour tout le site.
 *
 * Trois choses, et rien d'autre :
 *  · les plugins et les courbes enregistrés une fois ;
 *  · Lenis branché sur le ticker GSAP — donc UN seul rAF, jamais deux ;
 *  · la discipline de navigation : les scènes de la page meurent, celles du
 *    layout survivent, et on recalcule quand les métriques ont bougé.
 *
 * Aucune animation n'est déclenchée ici.
 */
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SplitText from 'gsap/SplitText';
import CustomEase from 'gsap/CustomEase';
import Lenis from 'lenis';
/* `html.lenis{height:auto}` et les gardes `data-lenis-prevent` : sans cette
   feuille, un conteneur défilant interne renvoie son geste à la page. */
import 'lenis/dist/lenis.css';

import { enregistrerEases } from './eases';
import { ecouterPret, quandPret } from './pret';
import { compterScenes, rafraichir, rafraichirApresImages, viderScenes } from './scene';

let lenis: Lenis | null = null;
let monte = false;

/** Le défilement adouci, s'il est en service (jamais en mouvement réduit). */
export const defilement = (): Lenis | null => lenis;

export const initMotion = (): void => {
  if (monte) return;
  monte = true;

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  enregistrerEases();

  /* Un onglet en arrière-plan rend des deltas énormes au retour. On plafonne
     plutôt que de laisser les timelines sauter d'un bloc. */
  gsap.ticker.lagSmoothing(500, 33);

  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduit) {
    /* `autoRaf: false` est le point important : Lenis ne bat pas de son côté,
       c'est le ticker GSAP qui l'avance. Un second rAF parallèle est la cause
       classique du jank qu'on ne sait pas expliquer. */
    lenis = new Lenis({ autoRaf: false, duration: 1.05, gestureOrientation: 'vertical' });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((temps) => lenis?.raf(temps * 1000));
  }

  ecouterPret();

  /* Poignée de recette — comptage des scènes et du battement. Retirée du
     paquet de production par le remplacement de `import.meta.env.DEV`. */
  if (import.meta.env.DEV) {
    window.__ecoMotion = {
      scenes: compterScenes,
      /* Nombre de fonctions branchées sur l'unique ticker du site. */
      battements: () => (gsap.ticker as unknown as { _listeners: unknown[] })._listeners.length,
      lenis: () => !!lenis,
    };
  }

  /* Les positions ne valent rien tant que les typographies ne sont pas posées :
     Fraunces est variable et change les hauteurs de ligne en arrivant. */
  quandPret(() => {
    document.fonts.ready.then(() => {
      rafraichir();
      rafraichirApresImages();
    });
  });

  /* ── Navigation ── */
  document.addEventListener('astro:before-swap', viderScenes);

  document.addEventListener('astro:page-load', () => {
    /* Le layout est persistant : Lenis garde ses métriques de la page
       précédente tant qu'on ne le lui dit pas. */
    lenis?.resize();
    quandPret(() => {
      document.fonts.ready.then(() => {
        rafraichir();
        rafraichirApresImages();
      });
    });
  });
};
