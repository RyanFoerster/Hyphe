/**
 * <eco-canvas> — l'organisme persistant qui vit derrière la page.
 *
 * Un même graphe (racines ramifiées + bande de mycélium + pollen) est rendu en
 * fondu continu : encre sur papier à `t = 0`, bioluminescence dans la nuit à
 * `t = 1`. Il écoute trois signaux :
 *  · `eco:mix`    — régime de la loupe ;
 *  · `eco:growth` — progression du scroll, qui fait pousser les branches ;
 *  · `eco:route`  — la route courante, qui recompose la disposition.
 */

type Mode = 'home' | 'herbier' | 'specimen' | 'espece-designer' | 'espece-dev' | 'contact' | 'legal';

interface Node {
  x: number;
  y: number;
  /** Position d'accueil en régime nuit — les nœuds s'agrègent en amas. */
  bx: number;
  by: number;
  depth: number;
  cluster: number;
}

interface Edge {
  a: number;
  b: number;
  depth: number;
}

interface Point {
  x: number;
  y: number;
}

interface Spore {
  x: number;
  y: number;
  ph: number;
}

interface Pollen extends Spore {
  s: number;
}

interface TrailMark extends Point {
  born: number;
}

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Opacité de l'organisme selon la route : discret là où la page est dense. */
const ALPHA: Record<Mode, number> = {
  home: 1,
  herbier: 0.5,
  specimen: 0.3,
  'espece-designer': 0.85,
  'espece-dev': 0.85,
  contact: 1,
  legal: 0.14,
};

type Rgb = [number, number, number];
const INK: Rgb = [18, 16, 14];
const MYCELIUM: Rgb = [42, 39, 36];
const CYAN: Rgb = [77, 240, 208];
const GREEN: Rgb = [156, 255, 87];

const MAX_DEPTH = 7;

export class EcoCanvas extends HTMLElement {
  private ctx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;

  private W = 0;
  private H = 0;

  /** Régime cible / régime rendu (lissé). */
  private t = 0;
  private tt = 0;
  /** Croissance cible / rendue. */
  private g = 0.15;
  private gg = 0.15;
  /** Opacité de route / densité de pollen, lissées. */
  private ra = 1;
  private pa = 0;

  private mode: Mode = 'home';
  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private disp: Point[] = [];
  private myc: Spore[] = [];
  private pollen: Pollen[] = [];
  private trail: TrailMark[] = [];

  private reduced = false;
  private announced = false;
  private raf = 0;
  private still: ReturnType<typeof setInterval> | undefined;
  private ready = false;

  private onMix = (e: WindowEventMap['eco:mix']) => {
    this.t = Math.max(0, Math.min(1, e.detail.t));
  };
  private onGrowth = (e: WindowEventMap['eco:growth']) => {
    this.g = Math.max(0.15, Math.min(1, e.detail.g));
  };
  private onRoute = (e: WindowEventMap['eco:route']) => {
    const mode = e.detail.mode as Mode;
    if (ALPHA[mode] !== undefined) this.mode = mode;
  };
  private onMove = (e: PointerEvent) => {
    if (this.reduced) return;
    if (Math.random() < 0.3) this.trail.push({ x: e.clientX, y: e.clientY, born: performance.now() });
    if (this.trail.length > 24) this.trail.shift();
  };
  private onResize = () => this.build();

  connectedCallback(): void {
    if (this.ready) return;
    this.ready = true;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block';
    this.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    const saved = window.__ecoMix?.read() ?? 0;
    this.t = saved;
    this.tt = saved;
    this.mode = (window.__ecoMode as Mode) ?? 'home';
    this.ra = ALPHA[this.mode] ?? 1;
    this.pa = this.mode === 'contact' ? 1 : 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    addEventListener('eco:mix', this.onMix);
    addEventListener('eco:growth', this.onGrowth);
    addEventListener('eco:route', this.onRoute);
    addEventListener('pointermove', this.onMove, { passive: true });
    addEventListener('resize', this.onResize);

    this.build();

    if (this.reduced) {
      // Mouvement réduit : une image fixe, rafraîchie seulement quand l'état change.
      this.gg = 1;
      this.still = setInterval(() => {
        this.tt = this.t;
        this.step(performance.now(), true);
      }, 250);
    } else {
      const loop = (now: number) => {
        this.raf = requestAnimationFrame(loop);
        this.step(now, false);
      };
      this.raf = requestAnimationFrame(loop);
    }
  }

  disconnectedCallback(): void {
    this.ready = false;
    this.innerHTML = '';
    cancelAnimationFrame(this.raf);
    if (this.still) clearInterval(this.still);
    removeEventListener('eco:mix', this.onMix);
    removeEventListener('eco:growth', this.onGrowth);
    removeEventListener('eco:route', this.onRoute);
    removeEventListener('pointermove', this.onMove);
    removeEventListener('resize', this.onResize);
  }

  /** Reconstruit le graphe : croissance récursive depuis le bas de l'écran. */
  private build(): void {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = (this.W = innerWidth);
    const h = (this.H = innerHeight);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Suite déterministe : la même fenêtre donne toujours le même organisme.
    let seed = 42;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const addNode = (x: number, y: number, depth: number, cluster: number) =>
      nodes.push({ x, y, bx: 0, by: 0, depth, cluster }) - 1;

    const grow = (x: number, y: number, angle: number, len: number, depth: number, cluster: number): number => {
      if (depth > 6 || len < 12) return addNode(x, y, depth, cluster);
      const nx = x + Math.cos(angle) * len;
      const ny = y - Math.sin(angle) * len;
      const i = addNode(x, y, depth, cluster);
      const kids = depth < 2 ? 2 : rng() < 0.6 ? 2 : 1;
      for (let k = 0; k < kids; k++) {
        const na = angle + (k - (kids - 1) / 2) * (0.5 + rng() * 0.5) + (rng() - 0.5) * 0.3;
        const j = grow(nx, ny, na, len * (0.68 + rng() * 0.14), depth + 1, kids > 1 && depth >= 2 ? cluster * 2 + k : cluster);
        edges.push({ a: i, b: j, depth });
      }
      return i;
    };

    const roots = Math.max(3, Math.round(w / 480));
    for (let r = 0; r < roots; r++) {
      const rx = w * (0.12 + (0.76 * r) / Math.max(1, roots - 1)) + (rng() - 0.5) * 60;
      grow(rx, h + 10, Math.PI / 2 + (rng() - 0.5) * 0.4, h * 0.16 + rng() * h * 0.05, 0, r + 1);
    }

    // Bande de mycélium, au ras du bas de l'écran.
    const mycN = Math.round(w / 26);
    this.myc = Array.from({ length: mycN + 1 }, (_, i) => ({
      x: (w * i) / mycN,
      y: h - 34 - rng() * 46,
      ph: rng() * TAU,
    }));

    // Positions d'accueil en régime nuit : chaque grappe se replie en amas.
    const clusters = new Map<number, Node[]>();
    for (const n of nodes) {
      const arr = clusters.get(n.cluster);
      if (arr) arr.push(n);
      else clusters.set(n.cluster, [n]);
    }
    const keys = [...clusters.keys()];
    const cols = Math.ceil(Math.sqrt(keys.length * (w / h)));
    keys.forEach((key, ci) => {
      const cx = (w * ((ci % cols) + 0.5)) / cols + (rng() - 0.5) * 40;
      const cy = ((h * (Math.floor(ci / cols) + 0.55)) / Math.ceil(keys.length / cols)) * 0.86 + 30;
      const arr = clusters.get(key)!;
      arr.forEach((n, ni) => {
        const rr = 14 + 60 * Math.sqrt(ni / arr.length);
        const aa = ni * 2.4;
        n.bx = cx + Math.cos(aa) * rr;
        n.by = cy + Math.sin(aa) * rr * 0.8;
      });
    });

    this.nodes = nodes;
    this.edges = edges;
    this.disp = nodes.map((n) => ({ x: n.x, y: n.y }));
    this.pollen = Array.from({ length: 130 }, () => ({
      x: rng() * w,
      y: rng() * h,
      s: 0.4 + rng() * 1.2,
      ph: rng() * TAU,
    }));
  }

  /** Déformation propre à chaque route — l'organisme épouse la page. */
  private routeXY(x: number, y: number, now: number): Point {
    const w = this.W;
    const h = this.H;
    switch (this.mode) {
      case 'herbier': {
        const grid = 64;
        return { x: Math.round(x / grid) * grid, y: Math.round(y / grid) * grid };
      }
      case 'specimen':
        return { x: w / 2 + (x - w / 2) * 1.3, y: h * 0.78 + (y - h / 2) * 0.5 };
      case 'espece-designer':
        return { x, y: y * 0.36 + 16 };
      case 'espece-dev':
        return { x, y: h * 0.62 + y * 0.34 };
      case 'contact':
        return { x: x + Math.sin(y * 0.02 + now / 1900) * 6, y };
      default:
        return { x, y };
    }
  }

  private step(now: number, snap: boolean): void {
    this.tt = lerp(this.tt, this.t, snap ? 1 : 0.06);
    this.gg = lerp(this.gg, this.g, snap ? 1 : 0.04);
    this.ra = lerp(this.ra, ALPHA[this.mode] ?? 1, snap ? 1 : 0.045);
    this.pa = lerp(this.pa, this.mode === 'contact' ? 1 : 0, snap ? 1 : 0.03);

    const k = snap ? 1 : 0.05;
    const t = smoothstep(this.tt);

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i]!;
      const target = this.routeXY(lerp(n.x, n.bx, t), lerp(n.y, n.by, t), now);
      const d = this.disp[i]!;
      d.x += (target.x - d.x) * k;
      d.y += (target.y - d.y) * k;
    }

    this.draw(now, t);

    // Premier frame dessiné : la simulation est réveillée. La dormance
    // (scripts/dormance-runtime.js) attend ce signal pour avancer.
    if (!this.announced) {
      this.announced = true;
      window.__ecoReady = true;
      dispatchEvent(new CustomEvent('eco:ready'));
    }
  }

  private draw(now: number, t: number): void {
    const { ctx, W: w, H: h } = this;
    const g = this.gg;
    const ra = this.ra;

    // Un régime peut être figé par attribut (planches de démonstration).
    const forced = this.getAttribute('regime');
    const f = forced === 'night' ? 1 : forced === 'paper' ? 0 : t;
    // Encre → lumière : bascule raide autour de 0,5, comme le texte de la page.
    const cf = forced ? f : Math.min(1, Math.max(0, (f - 0.42) / 0.16));
    const mix = (a: Rgb, b: Rgb, alpha: number) =>
      `rgba(${Math.round(lerp(a[0], b[0], cf))},${Math.round(lerp(a[1], b[1], cf))},${Math.round(lerp(a[2], b[2], cf))},${alpha})`;

    ctx.clearRect(0, 0, w, h);

    const wob = this.reduced ? 0 : (1 - f) * 2.2 * (this.mode === 'home' ? 1 : 0.4);

    for (const e of this.edges) {
      const vis = g * MAX_DEPTH - e.depth;
      if (vis <= 0) continue;
      const a = this.disp[e.a]!;
      const b = this.disp[e.b]!;
      const base = Math.min(1, vis) * (0.05 + 0.1 * (1 - e.depth / MAX_DEPTH)) * ra;
      const alpha = lerp(Math.min(0.55, base * 1.8 + 0.03 * ra), base, cf);
      const wx = Math.sin(now / 1600 + e.a) * wob;

      ctx.strokeStyle = mix(INK, CYAN, alpha);
      ctx.lineWidth = lerp(1.4 - e.depth * 0.16, 0.7, cf);
      ctx.beginPath();
      ctx.moveTo(a.x + wx, a.y);
      ctx.lineTo(b.x + wx, b.y);
      ctx.stroke();

      // Nutriments qui circulent — visibles seulement en régime télémétrie.
      if (cf > 0.5 && !this.reduced && (e.a + e.b) % 5 === 0) {
        const u = (now / 1400 + e.a * 0.13) % 1;
        ctx.fillStyle = `rgba(156,255,87,${0.5 * Math.min(1, vis) * ra * (cf - 0.5) * 2})`;
        ctx.beginPath();
        ctx.arc(lerp(a.x, b.x, u), lerp(a.y, b.y, u), 1.4, 0, TAU);
        ctx.fill();
      }
    }

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i]!;
      const vis = g * MAX_DEPTH - n.depth;
      if (vis <= 0) continue;
      const d = this.disp[i]!;
      const r = lerp(1.8 - n.depth * 0.15, 1.6, cf);
      const pulse = this.reduced ? 1 : lerp(1, 0.75 + 0.25 * Math.sin(now / 900 + n.x * 0.02), cf);
      ctx.fillStyle = mix(INK, CYAN, lerp(0.42, 0.5, cf) * Math.min(1, vis) * pulse * ra);
      ctx.beginPath();
      ctx.arc(d.x, d.y, Math.max(0.6, r), 0, TAU);
      ctx.fill();
    }

    // Bande de mycélium — persistante sur toutes les routes.
    const mycA = Math.max(0.35, ra);
    const mycY = (m: Spore) => m.y + (this.reduced ? 0 : Math.sin(now / 2200 + m.ph) * 4 * (1 - f * 0.6));
    ctx.beginPath();
    this.myc.forEach((m, i) => (i ? ctx.lineTo(m.x, mycY(m)) : ctx.moveTo(m.x, mycY(m))));
    ctx.strokeStyle = mix(MYCELIUM, CYAN, lerp(0.55, 0.28, cf) * mycA);
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let i = 0; i < this.myc.length; i += 3) {
      const m = this.myc[i]!;
      ctx.fillStyle = mix(INK, GREEN, lerp(0.45, 0.5, cf) * mycA);
      ctx.beginPath();
      ctx.arc(m.x, mycY(m), 1.3, 0, TAU);
      ctx.fill();
    }

    // Pollen en suspension — route pollinisation uniquement.
    if (this.pa > 0.02) {
      for (const p of this.pollen) {
        const py = (((p.y - (this.reduced ? 0 : now / 90) * p.s) % h) + h) % h;
        const px = p.x + Math.sin(now / 1400 + p.ph) * 10;
        ctx.fillStyle = mix(INK, GREEN, lerp(0.4, 0.45, cf) * this.pa);
        ctx.beginPath();
        ctx.arc(px, py, p.s, 0, TAU);
        ctx.fill();
      }
    }

    // Trace du curseur : pousse d'encre sur papier, réticule en télémétrie.
    const nw = performance.now();
    this.trail = this.trail.filter((p) => nw - p.born < 1600);
    for (const p of this.trail) {
      const age = (nw - p.born) / 1600;
      const alpha = (1 - age) * 0.5;
      if (cf < 0.5) {
        const height = 6 + age * 10;
        ctx.strokeStyle = `rgba(42,39,36,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(p.x + 3, p.y - height * 0.6, p.x + 1, p.y - height);
        ctx.stroke();
        ctx.fillStyle = `rgba(18,16,14,${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x + 1, p.y - height, 1.2, 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = `rgba(77,240,208,${alpha * 0.8})`;
        ctx.lineWidth = 0.7;
        ctx.strokeRect(p.x - 2, p.y - 2, 4, 4);
      }
    }
  }
}

export const registerEcoCanvas = (): void => {
  if (!customElements.get('eco-canvas')) customElements.define('eco-canvas', EcoCanvas);
};
