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

/**
 * Recette : `?glisse=lent` étire tout le mouvement de 25 %, pour comparer deux
 * réglages sur la même page sans reconstruire. Même esprit que `?loader=slow`.
 */
export const FACTEUR_GLISSE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('glisse') === 'lent'
    ? 1.25
    : 1;

/**
 * Durées de base, en secondes, exprimées dans la voix naturaliste.
 *
 * Réglées pour un GLISSEMENT, pas pour une apparition : le geste doit avoir le
 * temps de se voir. Avec un stagger resté à 70 ms et des lignes à 1,35 s, les
 * lignes se recouvrent à plus de 90 % — c'est ce recouvrement, plus que la
 * durée elle-même, qui donne la sensation de flux continu.
 */
export const DUREE = {
  /** Une ligne de texte qui monte sous son masque. */
  ligne: 1.35,
  /** Un mot de grand titre. */
  mot: 1.5,
  /** Un masque d'image qui se lève. */
  masque: 1.6,
  /** Un filet qui se trace, d'un bord à l'autre. */
  filet: 0.55,
  /** Un compteur qui rejoint sa valeur. */
  chiffre: 1.4,
  /** La montée d'encre : elle se termine AVEC le mouvement, jamais avant. */
  encre: 0.45,
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
 * Déclenchement.
 *
 * **Sens de la valeur**, parce que c'est là qu'on s'est trompés : `top X%`
 * place le HAUT de l'élément à X % **sous le bord haut** du viewport. Donc
 * X grand = bas de l'écran = déclenche TÔT (l'élément effleure à peine) ;
 * X petit = haut de l'écran = déclenche TARD (l'élément est franchement entré).
 *
 * À 72 %, plus d'un quart de la hauteur d'écran est déjà occupé par l'élément
 * quand le mouvement démarre.
 *
 * `?seuil=65`, `?seuil=80`… permet de le caler au ressenti sans reconstruire.
 * C'est un réglage de perception : il ne se décide pas sur des chiffres.
 */
const SEUIL_DEFAUT = 72;

const seuilDemande = (): number => {
  if (typeof location === 'undefined') return SEUIL_DEFAUT;
  const v = Number(new URLSearchParams(location.search).get('seuil'));
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : SEUIL_DEFAUT;
};

export const SEUIL = seuilDemande();

/**
 * Au moment du déclenchement, la bande réellement visible d'une section va de
 * `SEUIL` au bas de l'écran — soit (100 − SEUIL) % de hauteur. Un membre situé
 * plus bas que ça joue hors champ : sa révélation est perdue.
 *
 * Les phrases sont donc découpées à cette distance. Une section haute en forme
 * plusieurs, chacune déclenchée par son propre premier membre. Les éléments
 * proches restent groupés — c'est toujours une phrase, pas un élément isolé.
 */
export const SEPARATION_PHRASE = (100 - SEUIL) / 100;
export const DECLENCHEMENT = `top ${SEUIL}%`;

/**
 * Le retour n'est pas une arrivée : le hero se pose au lieu de pousser.
 * La timeline est la même, jouée 2,5 fois plus vite — durées et staggers se
 * resserrent ensemble, donc le rapport entre les blocs est conservé. 2,85 s
 * deviennent 1,14 s en naturaliste, 2,14 s deviennent 0,86 s en télémétrie :
 * le ratio des deux voix tient de lui-même.
 */
export const RETOUR_FACTEUR = 2.44;

/**
 * Le hero est une phrase composée de cinq blocs : aux durées du catalogue il
 * durerait 4,3 s. On ne l'allonge pas dans les mêmes proportions — il est joué
 * plus vite, ce qui le ramène sous 3,2 s. Le scénario, lui, est déjà au plus
 * serré que permet la règle de densité — un bloc ne peut pas partir avant que
 * l'avant-avant-dernier soit fini, sinon trois choses bougent ensemble. C'est
 * donc le facteur qui absorbe, pas les silences.
 */
export const HERO_FACTEUR = 1.4;

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
  (voix === 'tel' ? base * FACTEUR_TEL : base) * FACTEUR_GLISSE;

/**
 * La voix du moment, lue sur la loupe. Elle est lue **à la construction** de
 * chaque animation, jamais liée en continu : basculer le régime change le
 * vocabulaire de ce qui reste à jouer, pas l'état de ce qui est déjà révélé.
 */
export const voixCourante = (): Voix => (window.__ecoMix?.encre ?? 0) >= 0.5 ? 'tel' : 'nat';
