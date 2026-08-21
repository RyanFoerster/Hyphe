/**
 * Le redressement — arbre ⇄ tableau, un seul graphe.
 *
 * La topologie vient de `lib/arbre.ts` (sérialisée dans la page) ; les cibles
 * viennent du DOM (les lignes du tableau de télémétrie). Pendant le passage
 * de la loupe, une charpente est dessinée par-dessus les deux vues : les
 * courbes gravées se tendent en arêtes, les nœuds-fruits glissent vers leurs
 * lignes, l'encre devient filament (le `color-mix` des variables de régime
 * fait la couleur tout seul). Aux extrêmes, la charpente s'efface et les
 * vues normales reprennent — elle n'existe que pendant le redressement.
 *
 * Même vocabulaire de mouvement que l'organisme de fond : interpolation des
 * positions selon `eco:mix`, rien d'autre.
 */
import type { CharpenteArbre } from '~/lib/arbre';

interface Pt {
  x: number;
  y: number;
}

interface Brin {
  nat: Pt[];
  tel: Pt[];
  el: SVGPathElement;
}

interface Noeud {
  nat: Pt;
  tel: Pt;
  el: SVGCircleElement;
}

const NS = 'http://www.w3.org/2000/svg';
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const initCharpente = (): (() => void) => {
  const vues = document.querySelector<HTMLElement>('[data-herbier] [data-vues]');
  if (!vues) return () => {};
  // Mouvement réduit : les vues fondent simplement, pas de morphose.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  /** Le port visible au moment de la traversée : portrait ou espalier. */
  const portVisible = () => {
    for (const wrapper of vues.querySelectorAll<HTMLElement>('[data-arbre-vue]')) {
      const svgArbre = wrapper.querySelector<SVGSVGElement>('svg[data-arbre]');
      const donneesEl = wrapper.querySelector<HTMLScriptElement>('[data-charpente-donnees]');
      if (svgArbre && donneesEl && svgArbre.getBoundingClientRect().width > 0) {
        return { svgArbre, donnees: JSON.parse(donneesEl.textContent ?? '{}') as CharpenteArbre };
      }
    }
    return null;
  };

  let svg: SVGSVGElement | null = null;
  let brins: Brin[] = [];
  let noeuds: Noeud[] = [];
  let frais = false;

  /* ── Mesure et construction, au premier passage de chaque traversée ── */
  const construire = () => {
    svg?.remove();
    svg = null;
    brins = [];
    noeuds = [];

    const port = portVisible();
    if (!port) return;
    const { svgArbre, donnees } = port;

    const rectVues = vues.getBoundingClientRect();
    const rectArbre = svgArbre.getBoundingClientRect();
    const echelle = rectArbre.width / donnees.w;
    const enPx = ([x, y]: [number, number]): Pt => ({
      x: rectArbre.left - rectVues.left + x * echelle,
      y: rectArbre.top - rectVues.top + y * echelle,
    });

    /* Les cibles : le centre de chaque ligne du tableau, par slug. */
    const cibles = new Map<string, Pt>();
    for (const tr of vues.querySelectorAll<HTMLElement>('[data-rows] [data-specimen]')) {
      const r = tr.getBoundingClientRect();
      cibles.set(tr.dataset.sortId ?? '', {
        x: r.left - rectVues.left + 56,
        y: r.top - rectVues.top + r.height / 2,
      });
    }
    if (cibles.size === 0) return;
    const ys = [...cibles.values()].map((p) => p.y);
    const yHaut = Math.min(...ys) - 26;
    const yBas = Math.max(...ys) + 12;
    const X_TRONC = 10;
    const X_BRANCHE = 42;

    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${rectVues.width} ${rectVues.height}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute(
      'style',
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;z-index:2',
    );
    vues.appendChild(svg);

    const brin = (nat: Pt[], tel: Pt[], largeur: number): Brin => {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('fill', 'none');
      el.setAttribute(
        'stroke',
        'color-mix(in oklab, var(--color-tele-cyan) var(--mixp), var(--color-nat-100))',
      );
      el.setAttribute('stroke-width', String(largeur));
      el.setAttribute('stroke-linecap', 'round');
      svg!.appendChild(el);
      return { nat, tel, el };
    };

    /* Le tronc se tend en épine verticale, à gauche du tableau. */
    const troncNat = donnees.tronc.map(enPx);
    brins.push(
      brin(
        troncNat,
        troncNat.map((_, i) => ({
          x: X_TRONC,
          y: lerp(yBas, yHaut, i / (troncNat.length - 1)),
        })),
        1.6,
      ),
    );

    for (const branche of donnees.branches) {
      const siens = branche.fruits
        .map((f) => ({ f, cible: cibles.get(f.slug) }))
        .filter((x): x is { f: (typeof branche.fruits)[0]; cible: Pt } => !!x.cible);
      if (!siens.length) continue;
      /* La branche devient l'arête de son cluster d'année. */
      const yCluster = siens.reduce((acc, x) => acc + x.cible.y, 0) / siens.length;
      const natPts = branche.pts.map(enPx);
      brins.push(
        brin(
          natPts,
          natPts.map((_, i) => ({
            x: lerp(X_TRONC, X_BRANCHE, i / (natPts.length - 1)),
            y: yCluster,
          })),
          1.2,
        ),
      );

      for (const { f, cible } of siens) {
        /* Le pédoncule devient la liaison arête → ligne. */
        brins.push(brin([enPx(f.attache), enPx(f.centre)], [{ x: X_BRANCHE, y: yCluster }, cible], 1));
        /* Le fruit glisse jusqu'à sa ligne du tableau. */
        const el = document.createElementNS(NS, 'circle');
        el.setAttribute('r', '3');
        el.setAttribute(
          'fill',
          'color-mix(in oklab, var(--color-tele-cyan) var(--mixp), var(--color-nat-100))',
        );
        svg.appendChild(el);
        noeuds.push({ nat: enPx(f.centre), tel: cible, el });
      }
    }
  };

  /* ── Rendu : lerp des positions, visibilité en cloche ── */
  const rendre = (u: number) => {
    if (!svg) return;
    svg.style.opacity = String(Math.sin(u * Math.PI));
    if (u <= 0.001 || u >= 0.999) return;
    for (const b of brins) {
      const d = b.nat
        .map((p, i) => {
          const q = b.tel[i]!;
          return `${i ? 'L' : 'M'}${lerp(p.x, q.x, u).toFixed(1)} ${lerp(p.y, q.y, u).toFixed(1)}`;
        })
        .join(' ');
      b.el.setAttribute('d', d);
    }
    for (const nd of noeuds) {
      nd.el.setAttribute('cx', lerp(nd.nat.x, nd.tel.x, u).toFixed(1));
      nd.el.setAttribute('cy', lerp(nd.nat.y, nd.tel.y, u).toFixed(1));
    }
  };

  const onMix = (e: WindowEventMap['eco:mix']) => {
    const u = Math.min(1, Math.max(0, (e.detail.t - 0.42) / 0.16));
    if (u > 0 && u < 1) {
      // Une traversée commence : on re-mesure (le tri a pu changer l'ordre).
      if (!frais) {
        construire();
        frais = true;
      }
      rendre(u);
    } else {
      frais = false;
      if (svg) svg.style.opacity = '0';
    }
  };
  const onResize = () => {
    frais = false;
    if (svg) svg.style.opacity = '0';
  };

  addEventListener('eco:mix', onMix);
  addEventListener('resize', onResize, { passive: true });

  return () => {
    removeEventListener('eco:mix', onMix);
    removeEventListener('resize', onResize);
    svg?.remove();
  };
};
