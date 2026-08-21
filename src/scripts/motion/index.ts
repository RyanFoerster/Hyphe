/**
 * Le socle du mouvement — la partie qui part avec la page.
 *
 * Volontairement minuscule : elle ne contient ni GSAP ni Lenis. Elle branche
 * l'écoute du signal `eco:pret`, puis va chercher le moteur **après le premier
 * paint**, en parallèle de la dormance. Rien de ce qui est vital ne l'attend :
 * si le site est prêt avant le moteur, on révèle, et les entrées s'accrochent
 * quand il arrive.
 */
import { ecouterPret, estPret, quandPret } from './pret';
import { etatBattement } from './battement';

type Moteur = typeof import('./moteur');

let promesse: Promise<Moteur> | null = null;
let moteur: Moteur | null = null;

/** Va chercher le moteur, une seule fois. */
const chargerMoteur = (): Promise<Moteur> => {
  promesse ??= import('./moteur').then((m) => {
    m.demarrerMoteur();
    moteur = m;
    return m;
  });
  return promesse;
};

/**
 * Ce qui a besoin du moteur s'inscrit ici. Le rappel part dès qu'il est là —
 * immédiatement s'il l'est déjà. C'est le point d'accroche des étapes
 * suivantes : aucune animation n'importe GSAP directement.
 */
export const quandMoteur = (fn: (m: Moteur) => void): void => {
  void chargerMoteur().then(fn);
};

export const initMotion = (): void => {
  ecouterPret();

  /* Deux frames : on laisse le premier paint se faire, puis on demande le
     moteur. `fetchpriority` bas via le repli d'inactivité — la dormance et les
     planches passent devant, elles, elles se voient. */
  const reclamer = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => void chargerMoteur(), { timeout: 1200 });
    } else {
      setTimeout(() => void chargerMoteur(), 200);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(reclamer));

  if (import.meta.env.DEV) {
    window.__ecoMotion = {
      battement: etatBattement,
      moteurCharge: () => moteur !== null,
      pret: estPret,
      /* `scene.ts` importe ScrollTrigger : on passe par le moteur pour ne pas
         retomber GSAP dans le paquet de départ. */
      scenes: () => moteur?.compterScenes() ?? null,
    };
  }
};

/* Réexport pour les étapes suivantes — elles n'importent jamais GSAP. */
export { quandPret };
