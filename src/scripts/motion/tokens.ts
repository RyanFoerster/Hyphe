/**
 * Le vocabulaire du mouvement — valeurs uniques, pour tout le site.
 *
 * Aucune durée, aucun stagger, aucune amplitude ne doit être écrite ailleurs :
 * c'est ce fichier qui donne au site l'impression d'avoir été composé d'une
 * seule main. Si une valeur manque ici, elle s'ajoute ici.
 *
 * Deux voix, un seul squelette temporel — comme la loupe elle-même. La
 * télémétrie dit exactement la même chose que le naturaliste, dans les mêmes
 * distances, mais plus court et plus sec.
 */

/** Naturaliste (encre, croissance) ou télémétrie (signal, incrémentation). */
export type Voix = 'nat' | 'tel';

/** La télémétrie parle 25 % plus vite. Une seule constante, partout. */
export const FACTEUR_TEL = 0.75;

/** Durées de base, en secondes, exprimées dans la voix naturaliste. */
export const DUREE = {
  /** Une ligne de texte qui monte sous son masque. */
  ligne: 0.9,
  /** Un mot de grand titre. */
  mot: 1.05,
  /** Un masque d'image qui se lève. */
  masque: 1.15,
  /** Un filet qui se trace, d'un bord à l'autre. */
  filet: 0.4,
  /** Un compteur qui rejoint sa valeur. */
  chiffre: 1.4,
  /** La montée d'encre finale, en fin de révélation naturaliste. */
  encre: 0.2,
} as const;

/**
 * Écarts entre éléments d'un même groupe, en secondes.
 * Volontairement très inférieurs aux durées : la ligne suivante démarre
 * pendant que la précédente est encore en route. Ce chevauchement est ce qui
 * sépare « propre » de « vivant ».
 */
export const STAGGER = {
  ligne: 0.07,
  mot: 0.045,
  bloc: 0.09,
  carte: 0.08,
} as const;

/**
 * Déclenchement : l'élément est déjà en cours de lecture quand il finit
 * d'apparaître. Jamais le centre de l'écran — ça se ressent comme de la lenteur.
 */
export const DECLENCHEMENT = 'top 85%';

/**
 * Le souffle avant l'entrée quand la dormance a été sautée : juste de quoi
 * laisser le premier paint se stabiliser. Dans le cas `loader`, il vaut zéro —
 * l'entrée doit chevaucher la pose de la spore, pas lui succéder.
 */
export const SOUFFLE_SANS_LOADER = 0.08;

/**
 * Le retour n'est pas une arrivée : le hero se pose au lieu de pousser.
 * La timeline est la même, jouée 2,5 fois plus vite — durées et staggers se
 * resserrent ensemble, donc le rapport entre les blocs est conservé. 2,85 s
 * deviennent 1,14 s en naturaliste, 2,14 s deviennent 0,86 s en télémétrie :
 * le ratio des deux voix tient de lui-même.
 */
export const RETOUR_FACTEUR = 2.5;

/** Parallaxe : fonds et éléments décoratifs seulement, jamais le texte. */
export const PARALLAXE_MAX = 0.08;

/** Redressement de la pousse : la ligne n'arrive pas rigide. */
export const REDRESSEMENT = {
  /** Degrés de rotation résiduelle, résolus à zéro. */
  rotation: 2.4,
  /** Densité d'encre au départ (naturaliste) : le texte prend sur le papier. */
  encreDepart: 0.55,
} as const;

/** Traduit une durée naturaliste dans la voix demandée. */
export const duree = (base: number, voix: Voix): number =>
  voix === 'tel' ? base * FACTEUR_TEL : base;

/**
 * La voix du moment, lue sur la loupe. Elle est lue **à la construction** de
 * chaque animation, jamais liée en continu : basculer le régime change le
 * vocabulaire de ce qui reste à jouer, pas l'état de ce qui est déjà révélé.
 */
export const voixCourante = (): Voix => (window.__ecoMix?.encre ?? 0) >= 0.5 ? 'tel' : 'nat';
