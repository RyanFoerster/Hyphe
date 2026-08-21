/**
 * Le battement — l'unique boucle d'image du site, sans dépendance.
 *
 * L'organisme et la sporulation ne peuvent pas dépendre de GSAP : la dormance
 * attend le premier frame du canevas (`eco:ready`) pour avancer sa radicule.
 * Si le canevas attendait le paquet d'animation, le loader attendrait avec
 * lui — exactement ce qu'on cherche à éviter en différant GSAP.
 *
 * D'où cette couche : les organes vivants s'abonnent ICI, jamais à GSAP. Le
 * battement tourne d'abord sur son propre rAF, minuscule et immédiat ; quand
 * le moteur arrive, il lui cède la main et son rAF s'éteint. À aucun moment il
 * n'y a deux boucles.
 */

type Pulsation = () => void;

const abonnes = new Set<Pulsation>();
let rafId = 0;
let cede = false;

/** Un tour : chacun son tour, sur une copie — un abonné peut se désabonner. */
const pulser = (): void => {
  for (const fn of [...abonnes]) fn();
};

const propre = (): void => {
  rafId = requestAnimationFrame(propre);
  pulser();
};

const demarrer = (): void => {
  if (cede || rafId || !abonnes.size) return;
  rafId = requestAnimationFrame(propre);
};

const arreter = (): void => {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
};

/** S'abonner au battement. */
export const battre = (fn: Pulsation): void => {
  abonnes.add(fn);
  demarrer();
};

/** S'en retirer. Le battement s'arrête de lui-même quand il n'a plus personne. */
export const cesser = (fn: Pulsation): void => {
  abonnes.delete(fn);
  if (!abonnes.size) arreter();
};

/**
 * Le moteur est arrivé : son ticker prend le relais et notre rAF s'efface.
 * Irréversible et sans à-coup — la pulsation reste la même fonction, seule
 * la source du temps change.
 */
export const cederLeBattement = (ticker: { add(fn: () => void): void }): void => {
  if (cede) return;
  cede = true;
  arreter();
  ticker.add(pulser);
};

/** Recette : combien d'organes battent, et sur quelle source. */
export const etatBattement = (): { abonnes: number; source: 'propre' | 'moteur' | 'arrete' } => ({
  abonnes: abonnes.size,
  source: cede ? 'moteur' : rafId ? 'propre' : 'arrete',
});
