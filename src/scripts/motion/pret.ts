/**
 * Le signal « le site peut animer » — source de vérité unique.
 *
 * Il est émis par la dormance, dans `revealSite()`, qui est l'entonnoir des
 * DEUX chemins : loader montré (fin du handoff) et loader jamais montré
 * (chargement sous la grâce de 300 ms). Il n'y a donc pas deux variantes à
 * tenir, juste deux instants d'arrivée.
 *
 * Il ne dépend d'aucun paquet : la dormance est inlinée et n'attend rien. Le
 * moteur d'animation peut arriver après — les entrées s'accrocheront à lui.
 */

/**
 * Veille : si le signal n'arrive jamais, on ne joue pas la timeline en retard —
 * on révèle tout d'un coup, sans animation. Quelqu'un qui a déjà attendu ne
 * doit pas attendre une seconde fois.
 *
 * Deux échéances, parce que ce sont deux pannes différentes :
 *
 *  · 2 s quand la dormance **n'a pas démarré** (script absent, erreur avant sa
 *    première ligne). Rien ne viendra jamais : on n'a aucune raison d'attendre.
 *
 *  · 9,5 s quand elle tourne. Mesuré : sous un processeur bridé 4×, la dormance
 *    normale rend la main à ~2,65 s — une veille à 2 s la doublerait et
 *    couperait toutes les animations précisément sur les appareils lents, ceux
 *    qu'on cherche à ménager. Sa propre veille est à 8 s ; la nôtre se place
 *    après, pour le seul cas où `revealSite()` ne serait jamais atteint.
 */
const VEILLE_SANS_DORMANCE_MS = 2000;
const VEILLE_AVEC_DORMANCE_MS = 9500;

export interface Contexte {
  /** La dormance a-t-elle été vue ? Décide de l'enchaînement de l'entrée. */
  loader: boolean;
  /** Tout doit être posé immédiatement, sans mouvement. */
  instantane: boolean;
}

let pret = false;
let contexte: Contexte = { loader: false, instantane: false };
let attentes: Array<(c: Contexte) => void> = [];

const declencher = (c: Contexte) => {
  if (pret) return;
  pret = true;
  contexte = c;
  const file = attentes;
  attentes = [];
  for (const fn of file) fn(contexte);
};

/** Vrai dès que l'entrée a le droit de jouer. */
export const estPret = (): boolean => pret;

/** Le contexte d'arrivée du signal — valable seulement une fois `pret`. */
export const contextePret = (): Contexte => contexte;

/** Exécute maintenant si le signal est déjà passé, sinon à son arrivée. */
export const quandPret = (fn: (c: Contexte) => void): void => {
  if (pret) fn(contexte);
  else attentes.push(fn);
};

/**
 * Branche l'écoute. Appelé une fois par fenêtre : sur une navigation du
 * ClientRouter la dormance ne rejoue pas et `pret` reste vrai — les pages
 * suivantes animent donc sans rien attendre.
 */
export const ecouterPret = (): void => {
  /* Mouvement réduit : le site est prêt tout de suite, et sans mouvement. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    declencher({ loader: false, instantane: true });
    return;
  }
  if (window.__ecoPret) {
    declencher({ loader: false, instantane: false });
    return;
  }
  addEventListener('eco:pret', (e) => declencher({ loader: e.detail.loader, instantane: false }), {
    once: true,
  });

  /* La dormance est inlinée en tête de <body> et pose son drapeau de façon
     synchrone ; ce module, lui, est différé. Si le drapeau manque ici, c'est
     qu'elle ne s'exécutera pas du tout. */
  const veille = window.__okgDormance ? VEILLE_AVEC_DORMANCE_MS : VEILLE_SANS_DORMANCE_MS;
  setTimeout(() => declencher({ loader: false, instantane: true }), veille);
};
