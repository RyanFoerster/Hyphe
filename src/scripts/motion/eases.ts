/**
 * Les courbes — cinq, nommées, et rien d'autre dans tout le site.
 *
 * Aucune n'a de point de contrôle hors de [0,1] en ordonnée : pas de
 * dépassement, donc pas de rebond. Ce que la matière fait ici, elle le fait
 * une fois et s'arrête.
 *
 * Naturaliste : départ lent, arrivée très douce, franchement asymétrique —
 * une pousse ralentit en se posant. Télémétrie : départ franc, arrivée nette —
 * un signal ne flâne pas.
 */
import CustomEase from 'gsap/CustomEase';

/**
 * Croissance naturaliste — un glissement, pas une poussée.
 *
 * La courbe part avec de la vitesse déjà acquise, puis passe l'essentiel de son
 * temps dans l'approche finale : à 20 % du temps écoulé, plus de 80 % de la
 * distance est faite, et le dernier dixième de distance occupe près de la
 * moitié de la durée. C'est ce déséquilibre qui donne le fluide — une courbe
 * symétrique, même longue, ne donnerait que du lent.
 */
export const GROWTH = 'eco.growth';
/** La pose finale — ce qui rejoint sa place sans jamais la dépasser. */
export const SETTLE = 'eco.settle';
/** Signal de télémétrie : part net, arrive net. */
export const SIGNAL = 'eco.signal';
/** Le trait de plume : une vitesse presque constante, un arrêt propre. */
export const TRACE = 'eco.trace';
/** Décélération pure — les compteurs, qui ne doivent jamais accélérer. */
export const COUNT = 'eco.count';

let fait = false;

/** Enregistre les courbes une fois pour la fenêtre. */
export const enregistrerEases = (): void => {
  if (fait) return;
  fait = true;

  CustomEase.create(GROWTH, 'M0,0 C0.19,0.92 0.28,1 1,1');
  CustomEase.create(SETTLE, 'M0,0 C0.25,0.1 0.05,1 1,1');
  CustomEase.create(SIGNAL, 'M0,0 C0.05,0.7 0.1,1 1,1');
  CustomEase.create(TRACE, 'M0,0 C0.3,0.4 0.2,1 1,1');
  CustomEase.create(COUNT, 'M0,0 C0,0.55 0.15,1 1,1');
};

/** La courbe d'apparition qui correspond à la voix. */
export const easeApparition = (voix: 'nat' | 'tel'): string =>
  voix === 'tel' ? SIGNAL : GROWTH;
