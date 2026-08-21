/**
 * Point d'entrée client. Tout ce qui vit dans la page se branche ici, une
 * seule fois par navigation — `astro:page-load` couvre aussi le premier rendu.
 */
import { registerEcoCanvas } from './eco-canvas';
import { initLoupe } from './loupe';
import { initGrowth } from './growth';
import { initStageRail } from './stage-rail';
import { announceRoute } from './route';
import { initHerbier } from './herbier';
import { initArbre } from './arbre';
import { initCharpente } from './charpente';
import { initSporulation } from './sporulation';
import { initContactForm } from './contact-form';

type Cleanup = () => void;

let cleanups: Cleanup[] = [];

const mount = () => {
  for (const off of cleanups) off();
  cleanups = [];

  announceRoute();
  initLoupe();
  cleanups.push(
    initGrowth(),
    initStageRail(),
    initHerbier(),
    initArbre(),
    initCharpente(),
    initSporulation(),
  );
  initContactForm();
};

registerEcoCanvas();
document.addEventListener('astro:page-load', mount);

// L'échange de vue remplace les attributs de <html> : on repose le régime
// avant que la nouvelle page ne soit peinte, sinon elle clignote.
document.addEventListener('astro:after-swap', () => window.__ecoMix.apply(window.__ecoMix.t));
