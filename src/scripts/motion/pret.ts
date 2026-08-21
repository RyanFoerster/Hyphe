/**
 * Le signal « le site peut animer » — source de vérité unique.
 *
 * Émis par la dormance dans `revealSite()`, entonnoir de ses deux chemins :
 * loader montré (fin du handoff) et loader jamais montré (chargement sous la
 * grâce de 300 ms). Il ne dépend d'aucun paquet — la dormance est inlinée et
 * n'attend rien.
 *
 * Deux notions distinctes vivent ici, et il ne faut pas les confondre :
 *
 *  · `pret`   — on a le droit de jouer une entrée ;
 *  · `revele` — le contenu est DÉJÀ sous les yeux du visiteur.
 *
 * Le second est le garde-fou du moteur différé. Sur cache chaud, le signal
 * peut partir avant que GSAP soit là : le moteur arrive alors devant une page
 * déjà lue. Il ne doit rien masquer rétroactivement — on ne reprend jamais ce
 * qui a été donné.
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
 *  · 9,5 s quand elle tourne. Mesuré : sous un processeur bridé 6×, la dormance
 *    normale rend la main à ~2,77 s — une veille à 2 s la doublerait et
 *    couperait toutes les animations précisément sur les appareils lents, ceux
 *    qu'on cherche à ménager. Sa propre veille est à 8 s ; la nôtre se place
 *    après, pour le seul cas où `revealSite()` ne serait jamais atteint.
 */
const VEILLE_SANS_DORMANCE_MS = 2000;
const VEILLE_AVEC_DORMANCE_MS = 9500;

/**
 * · `loader`     — la dormance a été vue : l'entrée enchaîne sans pause.
 * · `rapide`     — elle a été sautée (cache chaud) : même timeline, précédée
 *                  d'un très court souffle pour ne pas partir avant le paint.
 * · `instantane` — veille déclenchée, ou mouvement réduit : tout est posé,
 *                  rien ne bouge, y compris si le moteur arrive ensuite.
 * · `retour`     — l'entrée a déjà eu lieu dans cette fenêtre et le visiteur
 *                  revient par une navigation interne. Ce cas ne vient PAS du
 *                  signal, qui ne se produit qu'une fois : c'est le hero qui le
 *                  décide au montage. Un rechargement dur ouvre une nouvelle
 *                  fenêtre, donc une nouvelle arrivée — comme la dormance.
 */
export type Cas = 'loader' | 'rapide' | 'instantane' | 'retour';

export interface Contexte {
  cas: Cas;
}

let pret = false;
let revele = false;
let contexte: Contexte = { cas: 'rapide' };
let attentes: Array<(c: Contexte) => void> = [];

const declencher = (cas: Cas) => {
  if (pret) return;
  pret = true;
  revele = true;
  contexte = { cas };
  const file = attentes;
  attentes = [];
  for (const fn of file) fn(contexte);
};

/** Vrai dès que l'entrée a le droit de jouer. */
export const estPret = (): boolean => pret;

/** Le cas d'arrivée du signal — valable seulement une fois `pret`. */
export const contextePret = (): Contexte => contexte;

/**
 * Le contenu est-il déjà à l'écran ? On consulte aussi le drapeau posé par la
 * dormance elle-même : entre sa révélation et l'initialisation de ce module,
 * la page est visible alors que notre propre `revele` ne l'est pas encore.
 */
export const estRevele = (): boolean => revele || window.__ecoPret === true;

/**
 * La porte du moteur. Fausse dès que le contenu est à l'écran : plus aucun
 * `gsap.set` masquant n'est permis au-dessus de la ligne de flottaison.
 */
export const peutMasquer = (): boolean => !estRevele();

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
  /* Mouvement réduit : prêt tout de suite, et sans mouvement. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    declencher('instantane');
    return;
  }
  /* La dormance a déjà rendu la main avant que ce module ne se branche. */
  if (window.__ecoPret) {
    declencher('rapide');
    return;
  }
  addEventListener('eco:pret', (e) => declencher(e.detail.loader ? 'loader' : 'rapide'), {
    once: true,
  });

  /* La dormance est inlinée en tête de <body> et pose son drapeau de façon
     synchrone ; ce module, lui, est différé. Si le drapeau manque ici, c'est
     qu'elle ne s'exécutera pas du tout. */
  const veille = window.__okgDormance ? VEILLE_AVEC_DORMANCE_MS : VEILLE_SANS_DORMANCE_MS;
  setTimeout(() => declencher('instantane'), veille);
};
