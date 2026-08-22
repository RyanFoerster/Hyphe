/**
 * Le catalogue — le vocabulaire appliqué au reste du site.
 *
 * Aucun geste nouveau : masque depuis le sol pour le texte et les planches,
 * trait de plume pour les filets, stagger vertical pour les groupes. La
 * répétition est voulue — c'est elle qui donne l'impression d'une seule main.
 *
 * **Un déclencheur par section, pas un par élément.** Si chaque titre, chaque
 * filet et chaque planche avait le sien, une section entière partirait d'un
 * bloc à l'entrée dans le viewport : trois ou quatre choses en mouvement au
 * même instant, la règle de densité rompue. Regroupés, ils forment une seule
 * phrase échelonnée, et deux blocs au plus se croisent.
 *
 * Le hero est exclu : il appartient à la timeline d'entrée, jamais au scroll.
 */
import type ScrollTriggerType from 'gsap/ScrollTrigger';
import gsap from 'gsap';

import { scene } from './scene';
import { revelerFilet, revelerGroupe, revelerPlanche, revelerTexte, type Revelation } from './texte';
import { DECLENCHEMENT, SEPARATION_PHRASE, STAGGER, duree, voixCourante, type Voix } from './tokens';

type Geste = 'texte' | 'titre' | 'filet' | 'planche' | 'groupe';

/**
 * Recette : combien de phrases sont réellement en train de se dire. C'est LA
 * mesure de la règle de densité — lire le DOM confondrait la libération d'un
 * masque avec un mouvement.
 */
export let phrasesEnCours: () => number = () => 0;

/**
 * Deux phrases en vol au maximum — la règle de densité, appliquée à la lettre.
 *
 * Ce qui dépasse n'est PAS mis en file : une phrase retardée resterait masquée
 * sous les yeux de quelqu'un qui la lit déjà, ce qui est pire que trois
 * mouvements. Elle est posée d'un coup, à son état final. Le cas ne se produit
 * qu'au défilement rapide — un lecteur qui lance la page d'un geste ne regarde
 * de toute façon pas les entrées.
 */
const EN_VOL_MAX = 2;

const construire = (el: HTMLElement, geste: Geste, voix: Voix): Revelation | null => {
  switch (geste) {
    /* Les titres de section restent découpés en LIGNES, pas en mots : à cette
       échelle un découpage par mots multiplie les morceaux sans rien ajouter,
       et le hero garde ainsi son geste à lui. */
    case 'titre':
      return revelerTexte(el, { voix, decoupe: 'lignes' });
    case 'texte':
      return revelerTexte(el, { voix, decoupe: 'bloc' });
    case 'filet':
      return revelerFilet(el, voix);
    case 'planche':
      return revelerPlanche(el, voix);
    /* Stagger vertical sur les enfants directs — jamais en cascade diagonale,
       même quand la grille en compte trois de front. */
    case 'groupe':
      return revelerGroupe([...el.children] as HTMLElement[], voix);
  }
};

export const monterCatalogue = (): (() => void) => {
  /* Les pages de service (mentions, confidentialité, 404) gardent le fondu de
     route CSS et rien d'autre. Comme `Eyebrow` et `SectionTitle` portent le
     geste à la source, il faut les écarter ici — sinon la double entrée qu'on
     vient d'éliminer revient par la porte des primitives partagées. */
  if (document.body.dataset.ecoMode === 'legal') return () => {};

  const voix = voixCourante();

  /* Une section = une phrase. On remonte au conteneur le plus proche qui en
     est un ; à défaut, l'élément forme sa propre phrase. */
  const sectionDe = (el: HTMLElement): Element =>
    el.closest('section, [data-bloc]') ?? el;

  const cibles = [...document.querySelectorAll<HTMLElement>('[data-reveler]')]
    .filter((el) => !el.closest('[data-hero-entree]'));

  /*
   * Une section, puis la proximité. Grouper toute une section haute en une
   * seule phrase ferait jouer ses membres du bas hors de l'écran — mesuré
   * jusqu'à 2,2 hauteurs d'écran sous le haut de section sur l'accueil. On
   * coupe donc dès qu'un membre sort de la bande visible au déclenchement.
   */
  const hautAbsolu = (el: HTMLElement) => el.getBoundingClientRect().top + scrollY;
  const separation = SEPARATION_PHRASE * innerHeight;

  const phrases: HTMLElement[][] = [];
  const parSection = new Map<Element, HTMLElement[]>();
  for (const el of cibles) {
    const cle = sectionDe(el);
    const liste = parSection.get(cle);
    if (liste) liste.push(el);
    else parSection.set(cle, [el]);
  }
  for (const membres of parSection.values()) {
    let courante: HTMLElement[] = [];
    let ancre = 0;
    for (const el of membres) {
      const y = hautAbsolu(el);
      if (!courante.length) { courante = [el]; ancre = y; continue; }
      if (y - ancre > separation) { phrases.push(courante); courante = [el]; ancre = y; }
      else courante.push(el);
    }
    if (courante.length) phrases.push(courante);
  }

  const revelations: Revelation[] = [];
  const declencheurs: ScrollTriggerType[] = [];
  const timelines: gsap.core.Timeline[] = [];
  const enAttente: Array<() => void> = [];
  let enVol = 0;

  for (const membres of phrases) {
    /* Le déclencheur est le PREMIER membre de la phrase, pas la section : une
       section haute en compte plusieurs, chacune doit partir à sa hauteur. */
    const ancreDom = membres[0]!;
    /* Chaque phrase rend la main dès qu'elle est dite : découpes défaites,
       `will-change` retiré. Le laisser en place immobiliserait une couche de
       composition par élément révélé, sur toute la durée de la visite. */
    const siennes: Revelation[] = [];
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        enVol = Math.max(0, enVol - 1);
        for (const r of siennes) r.rendre();
      },
    });
    let pose = false;

    membres.forEach((el, i) => {
      const r = construire(el, (el.dataset.reveler ?? 'texte') as Geste, voix);
      if (!r) return;
      revelations.push(r);
      siennes.push(r);
      /* Stagger vertical, dans l'ordre du DOM — donc de la lecture. Jamais en
         cascade diagonale. */
      tl.add(r.timeline, duree(STAGGER.bloc, voix) * i);
      pose = true;
    });
    if (!pose) continue;
    timelines.push(tl);

    /* Dire la phrase, ou la poser si l'air est déjà plein. Un seul chemin,
       partagé par le déclencheur de section et le repli de bas de page. */
    let dite = false;
    const dire = () => {
      if (dite) return;
      dite = true;
      if (enVol >= EN_VOL_MAX) {
        /* Trop de monde en l'air : celle-ci se pose sans jouer. */
        tl.progress(1, true);
        for (const r of siennes) r.rendre();
        return;
      }
      enVol++;
      tl.play();
    };
    enAttente.push(dire);

    declencheurs.push(
      scene({
        trigger: ancreDom,
        /* L'élément est déjà franchement entré quand le mouvement démarre.
           Une section déjà à l'écran au montage part immédiatement — c'est ce
           qui remplace le fondu de route au-dessus de la ligne de flottaison. */
        start: DECLENCHEMENT,
        once: true,
        onEnter: dire,
      }),
    );
  }

  /*
   * Repli de fin de course. À 92 %, une section trop proche du pied ne voit
   * jamais son seuil : la page n'a plus assez de hauteur pour l'amener là.
   * Quand le scroll touche le fond, tout ce qui attend encore est dit.
   */
  if (enAttente.length) {
    declencheurs.push(
      scene({
        trigger: document.body,
        start: 'bottom bottom',
        once: true,
        onEnter: () => {
          for (const dire of enAttente) dire();
        },
      }),
    );
  }

  phrasesEnCours = () => timelines.filter((t) => t.isActive()).length;

  return () => {
    phrasesEnCours = () => 0;
    for (const d of declencheurs) d.kill();
    for (const r of revelations) r.rendre();
  };
};
