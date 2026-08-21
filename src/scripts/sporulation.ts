/**
 * Le hover sporulant — la planche respire.
 *
 * Un souvenir de champignon traité en gravure : au survol d'un fruit, la
 * matière du dessin ondule (feTurbulence + feDisplacementMap sur le seul
 * cartouche survolé — il est en SVG inline, le filtre natif est l'outil
 * juste, et un déplacement de ~180 px² ne coûte rien), le contour se
 * dédouble comme une impression mal calée, l'encre de l'illustration
 * respire, et quelques spores se détachent et montent. En télémétrie, même
 * squelette : ondulation de scanline, aberration cyan/corail, points de
 * données. Tout est subliminal — amplitude 2-4 px, périodes lentes.
 *
 * Un seul foyer à la fois ; l'effet ne tourne que sur pointeur fin, jamais
 * en reduced-motion, et se coupe si le frame budget est dépassé. Toutes les
 * valeurs dérivent d'une enveloppe A(t) et du temps absolu : au retour au
 * repos, chaque style inline posé rend la main à la valeur du markup (le
 * socle) — aucune dérive cumulée, et la planche ne perd pas son
 * `--img-filter` en chemin.
 *
 * `?hover=slow` : périodes à 0,25×. `?hover=2x` : amplitude doublée (pour
 * caler le seuil en recette).
 */

import gsap from 'gsap';

interface Foyer {
  fruit: SVGGElement;
  corps: SVGGElement;
  image: SVGElement | null;
  latin: SVGTextElement | null;
  fantA: SVGRectElement | null;
  fantB: SVGRectElement | null;
  spores: SVGCircleElement[];
  donnee: SVGTextElement | null;
  turb: SVGFETurbulenceElement | null;
  disp: SVGFEDisplacementMapElement | null;
  filtreUrl: string;
  night: boolean;
  /** Origine du cartouche en coordonnées viewBox (pour poser les spores). */
  ox: number;
  oy: number;
  w: number;
  /** Enveloppe 0→1 : montée 450 ms, sortie 650 ms (250 ms si coupé net). */
  A: number;
  cible: number;
  sortieRapide: boolean;
  naissance: number;
}

let foyer: Foyer | null = null;
let mourants: Foyer[] = [];
/** La boucle tourne-t-elle ? Elle vit sur le ticker GSAP, pas sur son propre rAF. */
let actif = false;
let desactive = false;

/**
 * Le socle : la valeur que le markup avait posée en style inline avant qu'on
 * écrive par-dessus (`filter:var(--img-filter)` sur la planche, l'axe `WONK`
 * sur le latin). On la mémorise une fois par élément et on la restitue au
 * repos — la vider ferait revenir la planche en couleur.
 */
const socle = new WeakMap<SVGElement, string>();
const memoriser = (el: SVGElement | null, prop: string) => {
  if (el && !socle.has(el)) socle.set(el, el.style.getPropertyValue(prop));
};
const restituer = (el: SVGElement | null, prop: string) => {
  if (!el) return;
  const base = socle.get(el);
  if (base) el.style.setProperty(prop, base);
  else el.style.removeProperty(prop);
};

/** Ce qui n'appartient qu'à ce fruit — s'éteint avec lui. */
const eteindreFruit = (f: Foyer) => {
  restituer(f.corps, 'filter');
  restituer(f.image, 'filter');
  restituer(f.latin, 'font-variation-settings');
  f.fantA?.style.removeProperty('opacity');
  f.fantA?.style.removeProperty('transform');
  f.fantB?.style.removeProperty('opacity');
  f.fantB?.style.removeProperty('transform');
};

/**
 * Les organes partagés par toute la planche — un seul jeu de filtres et de
 * spores par SVG. Seul le foyer porteur les pilote : un fruit en train de se
 * calmer ne doit ni écrire dessus ni les remettre à zéro sous les pieds du
 * suivant.
 */
const eteindrePartage = (f: Foyer) => {
  f.disp?.setAttribute('scale', '0');
  for (const sp of f.spores) sp.setAttribute('opacity', '0');
  f.donnee?.setAttribute('opacity', '0');
};

const eteindre = (f: Foyer) => {
  eteindreFruit(f);
  eteindrePartage(f);
};

/** Rendre la planche nette : résorption douce, ou extinction sèche. */
const calmerSporulation = (immediat = false): void => {
  if (foyer) {
    if (immediat) {
      eteindre(foyer);
      mourants = mourants.filter((m) => m !== foyer);
    } else {
      foyer.cible = 0;
      foyer.sortieRapide = true;
      mourants.push(foyer);
    }
    foyer = null;
  }
  if (immediat) {
    for (const m of mourants) eteindre(m);
    mourants = [];
  }
};

export const initSporulation = (): (() => void) => {
  const conteneur = document.querySelector<HTMLElement>('[data-herbier] [data-view="nat"]');
  if (!conteneur) return () => {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  /* Pas d'effet au tap : pointeur fin uniquement. */
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  /* Trop de fruits visibles : la planche reste sage. */
  if (conteneur.querySelectorAll('[data-fruit-groupe]').length > 48) return () => {};

  const params = new URLSearchParams(location.search);
  const F = params.get('hover') === 'slow' ? 4 : 1;
  const AMP = params.get('hover') === '2x' ? 2 : 1;
  desactive = false;

  const allumer = (fruit: SVGGElement) => {
    if (desactive || foyer?.fruit === fruit) return;
    const night = document.documentElement.dataset.regime === 'night';

    /* Un seul filtre actif : le précédent est coupé net, en sortie douce. */
    if (foyer) {
      foyer.cible = 0;
      foyer.sortieRapide = true;
      restituer(foyer.corps, 'filter'); // le filtre suit le nouveau foyer
      mourants.push(foyer);
      foyer = null;
    }

    /* Ce fruit se calmait encore : on reprend son enveloppe là où elle en
       est plutôt que de repartir de zéro — le re-survol ne saute pas. */
    const encore = mourants.find((x) => x.fruit === fruit);
    if (encore) {
      mourants = mourants.filter((x) => x !== encore);
      if (encore.night === night) {
        encore.cible = 1;
        encore.sortieRapide = false;
        encore.corps.style.filter = encore.filtreUrl;
        foyer = encore;
        relancer();
        return;
      }
      /* La loupe a changé de régime entre-temps : ce foyer est périmé. */
      eteindreFruit(encore);
    }

    const svg = fruit.closest('svg');
    const corps = fruit.querySelector<SVGGElement>('.fruit-corps');
    if (!svg || !corps) return;
    const filtre = svg.querySelector<SVGFilterElement>(
      `filter[data-sporule="${night ? 'tel' : 'nat'}"]`,
    );
    if (!filtre) return;

    /* L'origine du cartouche, lue une fois dans son attribut de placement. */
    const placement = corps.parentElement?.getAttribute('transform') ?? '';
    const m = placement.match(/translate\(([\d.-]+)[ ,]([\d.-]+)\)/);
    const rects = corps.querySelectorAll('rect');
    const textes = corps.querySelectorAll('text');
    const sporesG = svg.querySelector<SVGGElement>('[data-spores]');

    foyer = {
      fruit,
      corps,
      image: corps.querySelector('image'),
      latin: (textes[2] as SVGTextElement) ?? null,
      fantA: fruit.querySelector('.fantome-a'),
      fantB: fruit.querySelector('.fantome-b'),
      spores: sporesG ? [...sporesG.querySelectorAll('circle')] : [],
      donnee: sporesG?.querySelector('.spore-donnee') ?? null,
      turb: filtre.querySelector('feTurbulence'),
      disp: filtre.querySelector('feDisplacementMap'),
      filtreUrl: `url(#${filtre.id})`,
      night,
      ox: m ? Number(m[1]) : 0,
      oy: m ? Number(m[2]) : 0,
      w: rects[0] ? Number(rects[0].getAttribute('width')) : 176,
      A: 0,
      cible: 1,
      sortieRapide: false,
      naissance: performance.now(),
    };
    memoriser(foyer.corps, 'filter');
    memoriser(foyer.image, 'filter');
    memoriser(foyer.latin, 'font-variation-settings');
    foyer.corps.style.filter = foyer.filtreUrl;
    relancer();
  };

  /* ── La respiration — tout dérive du temps absolu et de l'enveloppe ── */
  let derniere = 0;
  let lourdeur = 0;
  const animer = (f: Foyer, now: number, dt: number, porte: boolean) => {
    const vitesse = f.cible > f.A ? dt / (450 * F) : dt / ((f.sortieRapide ? 250 : 650) * F);
    f.A = Math.min(1, Math.max(0, f.A + (f.cible > f.A ? vitesse : -vitesse)));
    const A = f.A * AMP;
    const T = (now - f.naissance) / (1000 * F);

    /* La déformation : lente, douce, 2-4 px au plus. Le filtre est unique
       pour toute la planche — seul le porteur y touche. */
    if (porte && f.disp) f.disp.setAttribute('scale', (A * (f.night ? 2.4 : 3.4)).toFixed(2));
    if (porte && f.turb) {
      const bf = f.night
        ? `0.003 ${(0.09 + 0.018 * Math.sin((T * 2 * Math.PI) / 3.2)).toFixed(4)}`
        : `${(0.012 + 0.0026 * Math.sin((T * 2 * Math.PI) / 3.8)).toFixed(4)} ${(0.017 + 0.003 * Math.cos((T * 2 * Math.PI) / 3.1)).toFixed(4)}`;
      f.turb.setAttribute('baseFrequency', bf);
    }

    /* Le contour dédoublé qui dérive puis revient — l'impression mal calée. */
    const dx = 1.6 * Math.sin((T * 2 * Math.PI) / 3.4);
    const dy = 1.1 * Math.sin((T * 2 * Math.PI) / 4.1 + 1.2);
    if (f.fantA) {
      f.fantA.style.opacity = (0.34 * A).toFixed(2);
      f.fantA.style.transform = `translate(${(dx * A).toFixed(2)}px, ${(dy * A).toFixed(2)}px)`;
    }
    if (f.fantB) {
      /* En gravure, un seul trait ; l'aberration corail est télémétrique. */
      f.fantB.style.opacity = f.night ? (0.28 * A).toFixed(2) : '0';
      f.fantB.style.transform = `translate(${(-dx * A).toFixed(2)}px, ${(-dy * A).toFixed(2)}px)`;
    }

    /* L'encre respire : densité des hachures par vagues. */
    if (f.image) {
      const resp = 1 + 0.07 * A * Math.sin((T * 2 * Math.PI) / 3.6 + 0.6);
      f.image.style.filter = `${socle.get(f.image) ?? ''} contrast(${resp.toFixed(3)})`.trim();
    }

    /* Le latin ondule à peine — l'axe SOFT de Fraunces. */
    if (f.latin) {
      const soft = 24 * A * (0.5 + 0.5 * Math.sin((T * 2 * Math.PI) / 3.3));
      const base = socle.get(f.latin);
      f.latin.style.fontVariationSettings = `${base ? `${base}, ` : ''}'SOFT' ${soft.toFixed(0)}`;
    }

    /* Les spores : petits points d'encre qui montent et s'effacent. Un seul
       jeu par planche — même règle que le filtre. */
    if (!porte) return;
    f.spores.forEach((sp, i) => {
      const cycle = 2.6 + (i % 4) * 0.35;
      const u = ((T + i * 0.47) % cycle) / cycle;
      const x = f.ox + 12 + ((i * 37) % (f.w - 24)) + 4 * Math.sin(T * 2 + i);
      const y = f.oy + 6 - u * 46;
      sp.setAttribute('cx', x.toFixed(1));
      sp.setAttribute('cy', y.toFixed(1));
      sp.setAttribute(
        'opacity',
        (A * 0.38 * Math.sin(Math.PI * u) * (f.night ? 0.9 : 1)).toFixed(2),
      );
      if (f.night && i === 0 && f.donnee) {
        f.donnee.setAttribute('x', (x + 4).toFixed(1));
        f.donnee.setAttribute('y', y.toFixed(1));
        f.donnee.setAttribute('opacity', (A * 0.5 * Math.sin(Math.PI * u)).toFixed(2));
        f.donnee.textContent = `▲ 0,${String(Math.round(u * 90) + 10)}`;
      }
    });
    if (!f.night && f.donnee) f.donnee.setAttribute('opacity', '0');
  };

  const arreter = () => {
    if (!actif) return;
    actif = false;
    gsap.ticker.remove(boucle);
  };

  const boucle = () => {
    const now = performance.now();
    const dt = Math.min(80, now - derniere);
    derniere = now;
    /* Frame budget : si ça rame, on dégrade l'effet avant la fluidité. */
    lourdeur = lourdeur * 0.9 + (dt > 34 ? 1 : 0) * 0.1;
    if (lourdeur > 0.5) {
      desactive = true;
      calmerSporulation(true);
      arreter();
      return;
    }

    /* La loupe a basculé de régime sous le foyer : son filtre n'est plus le
       bon, on rend la planche nette plutôt que de la déformer de travers. */
    if (foyer && foyer.night !== (document.documentElement.dataset.regime === 'night')) {
      calmerSporulation(true);
      arreter();
      return;
    }

    /* Le porteur : celui qui a la main sur le filtre et les spores de la
       planche — le foyer vivant, sinon le dernier à s'être éteint. */
    const porteur = foyer ?? mourants[mourants.length - 1] ?? null;
    if (foyer) animer(foyer, now, dt, true);
    for (const m of mourants) animer(m, now, dt, m === porteur);

    const finis = mourants.filter((m) => m.A <= 0.001);
    for (const m of finis) eteindreFruit(m);
    mourants = mourants.filter((m) => m.A > 0.001);
    if (foyer && foyer.cible === 0 && foyer.A <= 0.001) {
      eteindreFruit(foyer);
      foyer = null;
    }

    /* Encore quelqu'un : le ticker rappellera de lui-même. */
    if (foyer || mourants.length) return;
    /* Plus personne sur la planche : les organes partagés retombent à zéro. */
    if (porteur) eteindrePartage(porteur);
    arreter();
  };

  const relancer = () => {
    if (actif) return;
    actif = true;
    derniere = performance.now();
    gsap.ticker.add(boucle);
  };

  const onOver = (e: Event) => {
    const fruit = (e.target as Element).closest<SVGGElement>('[data-fruit-groupe]');
    if (fruit) allumer(fruit);
  };
  const onOut = (e: Event) => {
    const ev = e as PointerEvent;
    const fruit = (ev.target as Element).closest<SVGGElement>('[data-fruit-groupe]');
    if (!fruit || foyer?.fruit !== fruit) return;
    if (ev.relatedTarget && fruit.contains(ev.relatedTarget as Node)) return;
    /* Sortie : la planche se calme, plus lentement qu'elle ne s'est animée. */
    foyer.cible = 0;
    foyer.sortieRapide = false;
    mourants.push(foyer);
    foyer = null;
  };
  conteneur.addEventListener('pointerover', onOver, { passive: true });
  conteneur.addEventListener('pointerout', onOut, { passive: true });

  return () => {
    conteneur.removeEventListener('pointerover', onOver);
    conteneur.removeEventListener('pointerout', onOut);
    calmerSporulation(true);
    arreter();
  };
};
