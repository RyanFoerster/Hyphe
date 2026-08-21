/**
 * Le socle du mouvement — la partie qui part avec la page.
 *
 * Volontairement minuscule : elle ne contient ni GSAP ni Lenis. Elle branche
 * l'écoute du signal `eco:pret`, puis va chercher le moteur **après le premier
 * paint**, en parallèle de la dormance. Rien de ce qui est vital ne l'attend :
 * si le site est prêt avant le moteur, on révèle, et les entrées s'accrochent
 * quand il arrive.
 */
import { contextePret, ecouterPret, estPret, estRevele, quandPret } from './pret';
import { etatBattement } from './battement';

type Moteur = typeof import('./moteur');

let promesse: Promise<Moteur> | null = null;
let moteur: Moteur | null = null;

/**
 * Recette : `?moteur=lent` retarde l'arrivée du moteur pour forcer le cas où
 * il débarque APRÈS le signal — celui où il ne doit plus rien masquer. Même
 * esprit que `?loader=slow` et `?loader=force` de la dormance.
 */
const RETARD_MS = new URLSearchParams(location.search).get('moteur') === 'lent' ? 3000 : 0;

/** Va chercher le moteur, une seule fois. */
const chargerMoteur = (): Promise<Moteur> => {
  promesse ??= (RETARD_MS ? new Promise<void>((r) => setTimeout(r, RETARD_MS)) : Promise.resolve())
    .then(() => import('./moteur'))
    .then((m) => {
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
      revele: estRevele,
      cas: () => (estPret() ? contextePret().cas : null),
      /* `scene.ts` et `masque.ts` importent GSAP : on passe par le moteur pour
         ne pas le faire retomber dans le paquet de départ. */
      scenes: () => moteur?.compterScenes() ?? null,
      masquageAutorise: () => moteur?.masquageAutorise() ?? null,
      masques: () => moteur?.compterMasques() ?? null,
      /* Siège de test : tente un masque et dit s'il a été accepté. C'est la
         porte elle-même qu'on éprouve, pas une imitation. */
      essaiMasque: (sel: string) => moteur?.preparer(sel, { autoAlpha: 0 }) ?? null,
      ralentir: (f: number) => moteur?.ralentir(f),
    };
  }
};

/* Réexport pour les étapes suivantes — elles n'importent jamais GSAP. */
export { quandPret };
