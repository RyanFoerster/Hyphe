/**
 * Le signal « le site peut animer » — source de vérité unique.
 *
 * Il est émis par la dormance, dans `revealSite()`, qui est l'entonnoir des
 * DEUX chemins : loader montré (fin du handoff) et loader jamais montré
 * (chargement sous la grâce de 300 ms). Il n'y a donc pas deux variantes à
 * tenir, juste deux instants d'arrivée.
 *
 * Rien de ce qui appartient à l'entrée ne doit se déclencher avant lui, et les
 * ScrollTrigger ne sont construits qu'après — plus `document.fonts.ready`, sans
 * quoi les positions seraient calculées sur des métriques fausses.
 */

/** Filet de sécurité : si la dormance échoue, le site anime quand même. */
const VEILLE_MS = 4000;

let pret = false;
let attentes: Array<() => void> = [];

const declencher = () => {
  if (pret) return;
  pret = true;
  const file = attentes;
  attentes = [];
  for (const fn of file) fn();
};

/** Vrai dès que l'entrée a le droit de jouer. */
export const estPret = (): boolean => pret;

/** Exécute maintenant si le signal est déjà passé, sinon à son arrivée. */
export const quandPret = (fn: () => void): void => {
  if (pret) fn();
  else attentes.push(fn);
};

/**
 * Branche l'écoute. Appelé une fois par fenêtre : sur une navigation du
 * ClientRouter la dormance ne rejoue pas, et `pret` reste vrai — les pages
 * suivantes animent donc sans attendre quoi que ce soit.
 */
export const ecouterPret = (): void => {
  if (window.__ecoPret) {
    declencher();
    return;
  }
  addEventListener('eco:pret', declencher, { once: true });
  setTimeout(declencher, VEILLE_MS);
};
